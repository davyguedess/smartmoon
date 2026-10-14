"""
Download e extração de texto de editais do PNCP.
Endpoint: /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos
"""
import asyncio
import httpx
import io
import os
import re
from typing import Optional
from loguru import logger

PNCP_BASE = "https://pncp.gov.br/api/pncp/v1"
REQUEST_TIMEOUT = 15.0
EDITAL_STORAGE_DIR = "/tmp/editais"


def parse_numero_controle(numero_controle: str) -> Optional[dict]:
    """
    Extrai cnpj, sequencial e ano do numeroControlePNCP.
    Formato: '01612441000107-1-000034/2026'
             cnpj-sequencialCompra-sequencialItem/ano
    """
    if not numero_controle:
        return None
    try:
        # Pattern: CNPJ-seqCompra-seqItem/ANO
        match = re.match(r'^(\d{14})-(\d+)-(\d+)/(\d{4})$', numero_controle.strip())
        if match:
            return {
                "cnpj": match.group(1),
                "sequencial_compra": match.group(2),
                "sequencial": match.group(3),
                "ano": match.group(4),
            }
        # Alternative format without middle part
        match = re.match(r'^(\d{14})-(\d+)/(\d{4})$', numero_controle.strip())
        if match:
            return {
                "cnpj": match.group(1),
                "sequencial": match.group(2),
                "ano": match.group(3),
            }
    except Exception as e:
        logger.warning(f"[EditalDownloader] Erro ao parsear numero_controle '{numero_controle}': {e}")
    return None


async def list_arquivos(cnpj: str, ano: str, sequencial: str) -> list[dict]:
    """Lista arquivos disponíveis para uma compra no PNCP."""
    url = f"{PNCP_BASE}/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos"
    try:
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
            headers={"Accept": "application/json", "User-Agent": "SmartMoon/1.0"},
        ) as client:
            resp = await client.get(url)
            logger.info(f"[EditalDownloader] GET {url} → {resp.status_code}")
            if resp.status_code != 200:
                return []
            return resp.json() if isinstance(resp.json(), list) else resp.json().get("data", [])
    except Exception as e:
        logger.warning(f"[EditalDownloader] Erro ao listar arquivos: {e}")
        return []


async def download_edital_pdf(cnpj: str, ano: str, sequencial: str, arquivo_id: int = None) -> Optional[dict]:
    """
    Baixa o PDF do edital de uma compra PNCP.
    Se arquivo_id não fornecido, tenta o primeiro arquivo da lista.
    Retorna dict com path, filename, text_content.
    """
    # 1. Lista arquivos disponíveis
    arquivos = await list_arquivos(cnpj, ano, sequencial)
    if not arquivos:
        logger.warning(f"[EditalDownloader] Nenhum arquivo encontrado para {cnpj}/{ano}/{sequencial}")
        return None

    # 2. Identifica arquivo do edital (prioriza tipo "edital" ou primeiro PDF)
    arquivo = None
    if arquivo_id:
        arquivo = next((a for a in arquivos if a.get("sequencialDocumento") == arquivo_id), None)
    if not arquivo:
        # Procura por arquivo com "edital" no titulo
        for a in arquivos:
            title = str(a.get("titulo", "") or a.get("nomeArquivo", "")).lower()
            if "edital" in title:
                arquivo = a
                break
        # Fallback: primeiro arquivo
        if not arquivo:
            arquivo = arquivos[0]

    # 3. Monta URL de download
    seq_doc = arquivo.get("sequencialDocumento", 1)
    download_url = f"{PNCP_BASE}/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos/{seq_doc}"

    try:
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={"User-Agent": "SmartMoon/1.0"},
        ) as client:
            resp = await client.get(download_url)
            logger.info(f"[EditalDownloader] Download {download_url} → {resp.status_code} ({len(resp.content)} bytes)")

            if resp.status_code != 200:
                return None

            # 4. Salva arquivo
            filename = arquivo.get("nomeArquivo", f"edital_{cnpj}_{ano}_{sequencial}.pdf")
            os.makedirs(EDITAL_STORAGE_DIR, exist_ok=True)
            filepath = os.path.join(EDITAL_STORAGE_DIR, f"{cnpj}_{ano}_{sequencial}_{filename}")
            with open(filepath, "wb") as f:
                f.write(resp.content)

            # 5. Extrai texto
            text_content = extract_text_from_content(resp.content)

            return {
                "filepath": filepath,
                "filename": filename,
                "file_size": len(resp.content),
                "text_content": text_content,
                "text_length": len(text_content) if text_content else 0,
                "arquivos_disponiveis": [
                    {
                        "id": a.get("sequencialDocumento"),
                        "titulo": a.get("titulo") or a.get("nomeArquivo", ""),
                        "tipo": a.get("tipoDocumento", ""),
                    }
                    for a in arquivos
                ],
            }
    except Exception as e:
        logger.error(f"[EditalDownloader] Erro ao baixar PDF: {e}")
        return None


def extract_text_from_content(file_bytes: bytes) -> Optional[str]:
    """Extrai texto de PDF, ZIP (contendo PDFs), ou DOCX."""
    # Detectar tipo de arquivo pelos magic bytes
    if file_bytes[:2] == b'PK':
        # ZIP ou DOCX
        return _extract_text_from_zip(file_bytes)
    elif file_bytes[:5] == b'%PDF-':
        return _extract_text_from_pdf(file_bytes)
    else:
        # Tenta como PDF mesmo assim (alguns PDFs podem ter BOM)
        text = _extract_text_from_pdf(file_bytes)
        if text:
            return text
        logger.warning(f"[EditalDownloader] Formato de arquivo desconhecido (magic: {file_bytes[:4].hex()})")
        return None


def _extract_text_from_zip(zip_bytes: bytes) -> Optional[str]:
    """Extrai texto de PDFs dentro de um arquivo ZIP."""
    import zipfile
    all_texts = []
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            pdf_files = [n for n in zf.namelist() if n.lower().endswith('.pdf')]
            docx_files = [n for n in zf.namelist() if n.lower().endswith('.docx')]
            other_files = [n for n in zf.namelist() if not n.endswith('/')]
            
            logger.info(f"[EditalDownloader] ZIP contém {len(zf.namelist())} arquivos: {len(pdf_files)} PDFs, {len(docx_files)} DOCX")
            
            # Processa PDFs encontrados
            for pdf_name in pdf_files:
                try:
                    pdf_data = zf.read(pdf_name)
                    text = _extract_text_from_pdf(pdf_data)
                    if text:
                        all_texts.append(f"=== {pdf_name} ===\n{text}")
                except Exception as e:
                    logger.warning(f"[EditalDownloader] Erro ao processar {pdf_name} do ZIP: {e}")
            
            # Se não encontrou PDFs, tenta outros arquivos texto
            if not all_texts:
                for fname in other_files:
                    if fname.lower().endswith(('.txt', '.html', '.htm', '.xml')):
                        try:
                            data = zf.read(fname)
                            text = data.decode('utf-8', errors='ignore')
                            if len(text) > 100:
                                all_texts.append(f"=== {fname} ===\n{text}")
                        except Exception:
                            pass
    except Exception as e:
        logger.error(f"[EditalDownloader] Erro ao processar ZIP: {e}")
        return None
    
    full_text = "\n\n".join(all_texts)
    if full_text:
        logger.info(f"[EditalDownloader] Texto extraído do ZIP: {len(full_text)} chars")
    return full_text if full_text else None


def _extract_text_from_pdf(pdf_bytes: bytes) -> Optional[str]:
    """Extrai texto de um PDF usando pdfplumber."""
    try:
        import pdfplumber
        pages_text = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text:
                    pages_text.append(f"--- Página {i + 1} ---\n{text}")
        full_text = "\n\n".join(pages_text)
        if full_text:
            logger.info(f"[EditalDownloader] Texto extraído: {len(full_text)} chars de {len(pages_text)} páginas")
        return full_text if full_text else None
    except ImportError:
        logger.error("[EditalDownloader] pdfplumber não instalado — instale com: pip install pdfplumber")
        return None
    except Exception as e:
        logger.error(f"[EditalDownloader] Erro ao extrair texto do PDF: {e}")
        return None


async def download_for_bid(bid_data: dict) -> Optional[dict]:
    """
    Entry point: recebe dict de uma licitação e tenta baixar o edital.
    Usa o external_bid_id (numeroControlePNCP) para construir a URL.
    """
    if bid_data.get("source") != "pncp":
        return {"error": "Download automático só é suportado para fonte PNCP"}

    numero = bid_data.get("external_bid_id", "")
    parsed = parse_numero_controle(numero)
    if not parsed:
        # Tenta extrair do raw_payload
        raw = bid_data.get("raw_payload_json", {})
        if isinstance(raw, dict):
            cnpj = raw.get("orgaoEntidade", {}).get("cnpj", "")
            ano = str(raw.get("anoCompra", ""))
            seq = str(raw.get("sequencialCompra", ""))
            if cnpj and ano and seq:
                parsed = {"cnpj": cnpj, "ano": ano, "sequencial": seq}

    if not parsed:
        return {"error": f"Não foi possível extrair dados do número de controle: {numero}"}

    return await download_edital_pdf(
        cnpj=parsed["cnpj"],
        ano=parsed["ano"],
        sequencial=parsed.get("sequencial", parsed.get("sequencial_compra", "1")),
    )
