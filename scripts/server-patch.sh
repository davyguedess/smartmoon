#!/bin/bash
# =============================================================
# Smart Moon — Server-side Patch Script
# Execute directly on the server: bash server-patch.sh
# =============================================================
set -euo pipefail
BACKEND="/opt/nexus/nexus-backend"
echo "🚀 Iniciando patch do servidor Smart Moon..."

# ── 1. generate_image_handler.py ─────────────────────────────
echo "📝 Criando generate_image_handler.py..."
cat > "$BACKEND/app/engine/handlers/generate_image_handler.py" << 'PYEOF'
"""NEXUS.IA — Generate Image Node Handler (Sprint A4)"""
from __future__ import annotations
import os
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler

class GenerateImageHandler(BaseNodeHandler):
    """Nó de geração de imagem via FAL.ai (Flux.1)."""
    async def execute(self, input_payload: dict) -> dict:
        fal_key = os.getenv("FAL_KEY", "").strip()
        if not fal_key:
            logger.warning("GenerateImageHandler: FAL_KEY não configurada")
            return {"image_url": None, "image_error": "FAL_KEY ausente — configure em /admin/settings"}
        prompt = (
            self.config.get("prompt")
            or self.context.get("image_prompt")
            or self.context.get("ai_response", "")
            or input_payload.get("message", "")
            or "Arte abstrata vibrante em tons de roxo e azul"
        )
        prompt = str(prompt).strip()[:500]
        size  = self.config.get("size",  "square_hd")
        model = self.config.get("model", "fal-ai/flux/dev")
        logger.info(f"🎨 GenerateImageHandler: prompt='{prompt[:60]}' size={size} model={model}")
        try:
            import fal_client
            os.environ["FAL_KEY"] = fal_key
            result = await fal_client.run_async(model, arguments={
                "prompt": prompt, "image_size": size,
                "num_images": 1, "enable_safety_checker": True,
            })
            images = result.get("images", [])
            if not images:
                raise ValueError("FAL.ai retornou lista vazia")
            image_url = images[0]["url"]
            logger.success(f"✅ Imagem gerada: {image_url[:80]}")
            return {"image_url": image_url, "image_prompt": prompt, "image_format": size, "image_error": None}
        except ImportError:
            return {"image_url": None, "image_error": "fal-client não instalado. Execute: pip install fal-client"}
        except Exception as e:
            logger.error(f"GenerateImageHandler error: {e}")
            return {"image_url": None, "image_error": str(e)}
PYEOF
echo "✅ generate_image_handler.py criado"

# ── 2. studio_projects.py ────────────────────────────────────
echo "📝 Criando studio_projects.py..."
cat > "$BACKEND/app/api/routes/marketing/studio_projects.py" << 'PYEOF'
"""NEXUS.IA — Studio Projects API (Sprint A3.3)"""
from __future__ import annotations
import json
from typing import Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from loguru import logger
from app.db.session import get_db
from app.api.routes.auth.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/studio/projects", tags=["Studio Projects"])

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    canvas_json: Dict[str, Any] = Field(default_factory=dict)
    thumbnail_url: Optional[str] = None
    template_id: Optional[int] = None
    format: Optional[str] = "square"

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    canvas_json: Optional[Dict[str, Any]] = None
    thumbnail_url: Optional[str] = None

async def _ensure_table(db: AsyncSession):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS studio_projects (
            id SERIAL PRIMARY KEY,
            company_id INT NOT NULL,
            user_id INT NOT NULL,
            name VARCHAR(200) NOT NULL DEFAULT 'Meu Projeto',
            canvas_json JSONB DEFAULT '{}',
            thumbnail_url TEXT,
            format VARCHAR(50) DEFAULT 'square',
            template_id INT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    await db.commit()

@router.get("")
async def list_projects(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    await _ensure_table(db)
    result = await db.execute(text("""
        SELECT id, name, thumbnail_url, format, template_id, created_at, updated_at
        FROM studio_projects WHERE company_id=:cid AND user_id=:uid
        ORDER BY updated_at DESC LIMIT :limit OFFSET :off
    """), {"cid": user.company_id, "uid": user.id, "limit": limit, "off": (page-1)*limit})
    return [dict(r) for r in result.mappings().all()]

@router.post("", status_code=201)
async def create_project(
    data: ProjectCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    await _ensure_table(db)
    result = await db.execute(text("""
        INSERT INTO studio_projects (company_id, user_id, name, canvas_json, thumbnail_url, format, template_id)
        VALUES (:cid, :uid, :name, :canvas::jsonb, :thumb, :fmt, :tid)
        RETURNING id, name, created_at, updated_at
    """), {"cid": user.company_id, "uid": user.id, "name": data.name,
           "canvas": json.dumps(data.canvas_json), "thumb": data.thumbnail_url,
           "fmt": data.format, "tid": data.template_id})
    row = result.mappings().one()
    await db.commit()
    logger.info(f"Studio project #{row['id']} criado por user {user.id}")
    return dict(row)

@router.get("/{project_id}")
async def get_project(project_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _ensure_table(db)
    result = await db.execute(text("SELECT * FROM studio_projects WHERE id=:id AND company_id=:cid"), {"id": project_id, "cid": user.company_id})
    row = result.mappings().one_or_none()
    if not row: raise HTTPException(404, "Projeto não encontrado")
    return dict(row)

@router.put("/{project_id}")
async def update_project(project_id: int, data: ProjectUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _ensure_table(db)
    updates, params = ["updated_at=NOW()"], {"id": project_id, "cid": user.company_id}
    if data.name: updates.append("name=:name"); params["name"] = data.name
    if data.canvas_json: updates.append("canvas_json=:canvas::jsonb"); params["canvas"] = json.dumps(data.canvas_json)
    if data.thumbnail_url: updates.append("thumbnail_url=:thumb"); params["thumb"] = data.thumbnail_url
    await db.execute(text(f"UPDATE studio_projects SET {','.join(updates)} WHERE id=:id AND company_id=:cid"), params)
    await db.commit()
    return {"id": project_id, "updated": True}

@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _ensure_table(db)
    result = await db.execute(text("DELETE FROM studio_projects WHERE id=:id AND company_id=:cid RETURNING id"), {"id": project_id, "cid": user.company_id})
    if not result.scalar_one_or_none(): raise HTTPException(404, "Projeto não encontrado")
    await db.commit()
PYEOF
echo "✅ studio_projects.py criado"

# ── 3. studio_uploads.py ─────────────────────────────────────
echo "📝 Criando studio_uploads.py..."
cat > "$BACKEND/app/api/routes/marketing/studio_uploads.py" << 'PYEOF'
"""NEXUS.IA — Studio Asset Upload API (Sprint A3.5)"""
from __future__ import annotations
import os, uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.api.routes.auth.auth import get_current_user
from app.models import User
from loguru import logger

router = APIRouter(prefix="/studio", tags=["Studio Uploads"])
UPLOADS_BASE = Path("./uploads/studio")
MAX_MB = 10
ALLOWED = {"image/jpeg","image/png","image/webp","image/gif","image/svg+xml"}

def _dir(cid: int) -> Path:
    p = UPLOADS_BASE / str(cid); p.mkdir(parents=True, exist_ok=True); return p
def _url(cid: int, fn: str) -> str: return f"/uploads/studio/{cid}/{fn}"

@router.post("/upload")
async def upload_asset(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    ct = file.content_type or ""
    if ct not in ALLOWED:
        raise HTTPException(415, f"Tipo não suportado: {ct}")
    content = await file.read()
    if len(content) / 1048576 > MAX_MB:
        raise HTTPException(413, f"Arquivo muito grande. Máx: {MAX_MB}MB")
    ext = Path(file.filename or "img.png").suffix.lower() or ".png"
    fn = f"{uuid.uuid4().hex}{ext}"
    ((_dir(user.company_id)) / fn).write_bytes(content)
    logger.info(f"Studio upload: {fn} by company {user.company_id}")
    return {"url": _url(user.company_id, fn), "filename": fn, "original_name": file.filename, "size_bytes": len(content), "mime_type": ct}

@router.get("/uploads")
async def list_uploads(user: User = Depends(get_current_user)):
    d = _dir(user.company_id)
    ext_map = {".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".gif":"image/gif",".svg":"image/svg+xml"}
    files = [{"filename": f.name, "url": _url(user.company_id, f.name), "size_bytes": f.stat().st_size, "mime_type": ext_map.get(f.suffix.lower(), "image/png"), "uploaded_at": f.stat().st_mtime}
             for f in sorted(d.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True) if f.is_file()]
    return {"total": len(files), "files": files}

@router.delete("/uploads/{filename}", status_code=204)
async def delete_upload(filename: str, user: User = Depends(get_current_user)):
    if "/" in filename or ".." in filename: raise HTTPException(400, "Nome inválido")
    t = _dir(user.company_id) / filename
    if not t.exists(): raise HTTPException(404, "Arquivo não encontrado")
    t.unlink()
PYEOF
echo "✅ studio_uploads.py criado"

# ── 4. Patch node_registry.py ────────────────────────────────
echo "🔧 Patchando node_registry.py..."
python3 << 'PYEOF'
import re, sys
path = "/opt/nexus/nexus-backend/app/engine/node_registry.py"
content = open(path).read()

if "generate_image" in content:
    print("⚠️  generate_image já registrado — pulando")
    sys.exit(0)

# Adicionar import
content = content.replace(
    "from app.engine.handlers.check_whatsapp_handler import CheckWhatsAppHandler",
    "from app.engine.handlers.generate_image_handler import GenerateImageHandler\nfrom app.engine.handlers.check_whatsapp_handler import CheckWhatsAppHandler"
)

# Adicionar entradas no registry
content = content.replace(
    '    "wait_payment": WaitEventHandler,\n}',
    '''    "wait_payment": WaitEventHandler,

    # Image Generation (FAL.ai / Flux)
    "generate_image": GenerateImageHandler,
    "image_gen":      GenerateImageHandler,
    "fal_image":      GenerateImageHandler,
    "flux":           GenerateImageHandler,
    "ai_image":       GenerateImageHandler,
}'''
)

open(path, "w").write(content)
print("✅ node_registry.py patchado")
PYEOF

# ── 5. Patch main.py ─────────────────────────────────────────
echo "🔧 Patchando main.py..."
python3 << 'PYEOF'
import sys
path = "/opt/nexus/nexus-backend/app/main.py"
content = open(path).read()

changes = 0
if "studio_projects_router" not in content:
    content = content.replace(
        "from app.api.routes.marketing import campaign_router, brand_kit_router, studio_templates_router",
        "from app.api.routes.marketing import campaign_router, brand_kit_router, studio_templates_router\nfrom app.api.routes.marketing.studio_projects import router as studio_projects_router\nfrom app.api.routes.marketing.studio_uploads import router as studio_uploads_router"
    )
    content = content.replace(
        "app.include_router(studio_templates_router)",
        "app.include_router(studio_templates_router)\napp.include_router(studio_projects_router)\napp.include_router(studio_uploads_router)"
    )
    changes += 1

if "_studio_storage" not in content:
    content = content.replace(
        '# Serve brand kit logos publicly\n_brand_storage = Path("./uploads/brand")',
        '# Serve brand kit logos publicly\n_brand_storage = Path("./uploads/brand")\n# Studio uploads\n_studio_storage = Path("./uploads/studio")\n_studio_storage.mkdir(parents=True, exist_ok=True)\n'
    )

open(path, "w").write(content)
print(f"✅ main.py patchado ({changes} blocos alterados)")
PYEOF

# ── 6. Patch nginx (se necessário) ───────────────────────────
echo "🔧 Verificando nginx..."
NGINX_CONF=$(find /etc/nginx -name "*.conf" | xargs grep -l "nexus_api" 2>/dev/null | head -1)
if [ -n "$NGINX_CONF" ]; then
    if grep -q "studio" "$NGINX_CONF"; then
        echo "✅ Nginx já tem rotas /studio"
    else
        python3 << PYEOF2
path = "$NGINX_CONF"
content = open(path).read()
# Padrão mais genérico — adiciona studio|marketing a qualquer regex de localização
import re
new_content = re.sub(
    r'(store|voice|flows|executions|agents|skills|settings|integrations|billing|payments)',
    r'\1|studio|marketing',
    content, count=1
)
if new_content != content:
    open(path, "w").write(new_content)
    print("✅ Nginx patchado com /studio e /marketing")
else:
    print("⚠️  Não conseguiu patchar nginx automaticamente")
PYEOF2
        nginx -t 2>&1 && nginx -s reload && echo "✅ Nginx recarregado" || echo "❌ Nginx com erro — verificar manualmente"
    fi
else
    echo "⚠️  Conf nginx não encontrado — verificar manualmente"
fi

# ── 7. Instalar fal-client (se não instalado) ─────────────────
echo "📦 Verificando fal-client..."
docker exec nexus_api pip show fal-client > /dev/null 2>&1 && echo "✅ fal-client já instalado" || \
  docker exec nexus_api pip install fal-client --quiet && echo "✅ fal-client instalado"

# ── 8. Copiar arquivos para o container e reiniciar ───────────
echo "🔄 Reiniciando API container..."
cd /opt/nexus
docker compose -f docker-compose.prod.yml restart api 2>&1
echo "⏳ Aguardando startup (15s)..."
sleep 15
docker logs nexus_api --tail 12
echo ""
echo "🔍 Health check..."
curl -s http://127.0.0.1:8000/health | python3 -m json.tool 2>/dev/null || curl -s http://127.0.0.1:8000/health
echo ""
echo "✅ Patch completo!"
