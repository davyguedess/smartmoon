#!/bin/bash
# =============================================================
# Smart Moon — Deploy Script Seguro (Sprint A1.4)
# Sincroniza backend NEM sobrescreve .env de produção
# =============================================================
set -euo pipefail

SERVER="root@187.127.14.153"
REMOTE_DIR="/opt/nexus/nexus-backend"
LOCAL_DIR="/Users/vrv-ia/BETA1/nexus-backend"

echo "🚀 Iniciando deploy backend Smart Moon..."
echo "→ Destino: $SERVER:$REMOTE_DIR"

# ── 1. Sincronizar código (EXCLUINDO .env*) ─────────────────
echo ""
echo "📦 Sincronizando arquivos..."
rsync -az \
  --exclude=".env" \
  --exclude=".env.*" \
  --exclude="*.env" \
  --exclude="__pycache__/" \
  --exclude="*.pyc" \
  --exclude="*.pyo" \
  --exclude=".git/" \
  --exclude="*.egg-info/" \
  --exclude="venv/" \
  --exclude=".venv/" \
  --exclude="dist/" \
  --exclude="build/" \
  --exclude="*.log" \
  --exclude="storage/" \
  --exclude="uploads/" \
  -e "ssh -o StrictHostKeyChecking=no" \
  "$LOCAL_DIR/" \
  "$SERVER:$REMOTE_DIR/"

echo "✅ Arquivos sincronizados"

# ── 2. Executar rebuild no servidor ─────────────────────────
echo ""
echo "🔨 Fazendo rebuild do container..."
ssh -o StrictHostKeyChecking=no "$SERVER" bash << 'REMOTE_SCRIPT'
  set -e
  cd /opt/nexus/nexus-backend

  # Garantir que prod .env está em uso
  if [ -f ".env.production" ]; then
    cp .env.production .env
    echo "✅ .env atualizado a partir do .env.production"
  else
    echo "⚠️  AVISO: .env.production não encontrado! Usando .env existente."
  fi

  # Rebuild e restart do container nexus_api
  docker compose -f ../docker-compose.prod.yml up -d --build api 2>&1 | tail -20

  # Aguardar startup
  echo "⏳ Aguardando API iniciar..."
  sleep 15

  # Health check
  HEALTH=$(curl -s http://127.0.0.1:8000/health -w "\nHTTP:%{http_code}" 2>/dev/null)
  echo "Health check: $HEALTH"

  echo "✅ Deploy concluído!"
REMOTE_SCRIPT

echo ""
echo "✅ Deploy completo! Verificando em produção..."
curl -s https://smartmoon.online/health -w "\nHTTP:%{http_code}" 2>/dev/null
echo ""
