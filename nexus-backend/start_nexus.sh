#!/bin/bash
# NEXUS.IA — Script de startup completo
# Uso: bash start_nexus.sh

BACKEND_DIR="/Users/vrv-ia/BETA1/nexus-backend"
FRONTEND_DIR="/Users/vrv-ia/BETA1/nexus-ia"
LOG_DIR="/tmp/nexus_logs"

mkdir -p "$LOG_DIR"

echo "🚀 NEXUS.IA — Iniciando serviços..."

# ── Backend (uvicorn) ─────────────────────────────────────
echo "📦 Iniciando backend em porta 8000..."
cd "$BACKEND_DIR"
source venv/bin/activate

# Mata instâncias anteriores
pkill -f "uvicorn app.main:app" 2>/dev/null
sleep 1

nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload \
  > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "  → Backend PID: $BACKEND_PID"

# ── Frontend (vite) ──────────────────────────────────────
echo "🎨 Iniciando frontend em porta 5173..."
pkill -f "vite" 2>/dev/null
sleep 1

cd "$FRONTEND_DIR"
nohup node_modules/.bin/vite --host 0.0.0.0 --port 5173 \
  > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "  → Frontend PID: $FRONTEND_PID"

# ── Aguarda serviços subirem ─────────────────────────────
echo ""
echo "⏳ Aguardando serviços..."
sleep 5

# ── Health check ─────────────────────────────────────────
echo ""
echo "🔍 Verificando saúde dos serviços:"

if curl -sf http://localhost:8000/health > /dev/null; then
  echo "  ✅ Backend: http://localhost:8000 (OK)"
  curl -s http://localhost:8000/health | python3 -m json.tool
else
  echo "  ❌ Backend: NÃO respondendo — veja $LOG_DIR/backend.log"
fi

echo ""

if curl -sf http://localhost:5173 > /dev/null; then
  echo "  ✅ Frontend: http://localhost:5173 (OK)"
elif curl -sf http://localhost:5174 > /dev/null; then
  echo "  ✅ Frontend: http://localhost:5174 (OK — porta alternativa)"
else
  echo "  ❌ Frontend: NÃO respondendo — veja $LOG_DIR/frontend.log"
fi

echo ""
echo "📋 PIDs:"
echo "  Backend:  $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo ""
echo "📁 Logs em: $LOG_DIR/"
echo "  tail -f $LOG_DIR/backend.log"
echo "  tail -f $LOG_DIR/frontend.log"
echo ""
echo "🛑 Para parar: kill $BACKEND_PID $FRONTEND_PID"
