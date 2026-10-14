"""
NEXUS.IA — Studio Asset Upload API (Sprint A3.5)
Upload de imagens/logos para usar no editor do Studio.

Endpoint:
  POST /studio/upload             → upload de imagem
  GET  /studio/uploads            → lista arquivos do usuário
  DELETE /studio/uploads/{name}   → remove arquivo
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import get_db
from app.api.routes.auth.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/studio", tags=["Studio Uploads"])

# Diretório base para uploads
UPLOADS_BASE = Path("./uploads/studio")
MAX_FILE_SIZE_MB = 10
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}


def _get_company_dir(company_id: int) -> Path:
    """Retorna (e cria) o diretório de uploads da empresa."""
    path = UPLOADS_BASE / str(company_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _file_url(company_id: int, filename: str) -> str:
    """Retorna a URL pública do arquivo."""
    return f"/uploads/studio/{company_id}/{filename}"


# ── Upload ─────────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_asset(
    file: UploadFile = File(...),
    user: User       = Depends(get_current_user),
):
    """
    Upload de imagem para usar no Studio.
    Suporta: JPEG, PNG, WebP, GIF, SVG.
    Tamanho máximo: 10 MB.
    """
    # Validar tipo MIME
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Tipo de arquivo não suportado: {content_type}. "
                   f"Use: {', '.join(ALLOWED_TYPES)}"
        )

    # Ler conteúdo
    contents = await file.read()

    # Validar tamanho
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo muito grande: {size_mb:.1f} MB. Máximo: {MAX_FILE_SIZE_MB} MB."
        )

    # Gerar nome único preservando extensão original
    original_ext = Path(file.filename or "image.png").suffix.lower() or ".png"
    filename     = f"{uuid.uuid4().hex}{original_ext}"

    # Salvar no disco
    company_dir = _get_company_dir(user.company_id)
    dest        = company_dir / filename
    with open(dest, "wb") as f:
        f.write(contents)

    file_url = _file_url(user.company_id, filename)
    logger.info(f"Studio upload: {filename} ({size_mb:.2f} MB) by company {user.company_id}")

    return {
        "url":          file_url,
        "filename":     filename,
        "original_name": file.filename,
        "size_bytes":   len(contents),
        "mime_type":    content_type,
    }


# ── Listar uploads da empresa ─────────────────────────────────────────────────

@router.get("/uploads")
async def list_uploads(
    user: User = Depends(get_current_user),
):
    """Lista todos os arquivos enviados pela empresa para o Studio."""
    company_dir = _get_company_dir(user.company_id)

    files = []
    for f in sorted(company_dir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file() and not f.name.startswith("."):
            stat     = f.stat()
            ext      = f.suffix.lower()
            mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                        ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml"}
            files.append({
                "filename":   f.name,
                "url":        _file_url(user.company_id, f.name),
                "size_bytes": stat.st_size,
                "mime_type":  mime_map.get(ext, "image/png"),
                "uploaded_at": stat.st_mtime,
            })

    return {"total": len(files), "files": files}


# ── Deletar upload ─────────────────────────────────────────────────────────────

@router.delete("/uploads/{filename}", status_code=204)
async def delete_upload(
    filename: str,
    user:     User = Depends(get_current_user),
):
    """Remove um arquivo de upload do Studio."""
    # Sanitizar filename (prevenir path traversal)
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Nome de arquivo inválido")

    company_dir = _get_company_dir(user.company_id)
    target      = company_dir / filename

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    target.unlink()
    logger.info(f"Studio upload deleted: {filename} by company {user.company_id}")
