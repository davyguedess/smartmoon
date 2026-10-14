#!/bin/bash
# ══════════════════════════════════════════════════════════════
# NEXUS.IA — Script de Migrations (Sprints 2-8)
# Rodar na VPS dentro do container PostgreSQL
# ══════════════════════════════════════════════════════════════
#
# COMO USAR:
# 1. ssh root@187.127.14.153
# 2. cd /opt/nexus/nexus-backend
# 3. Copiar os arquivos de migration para o container:
#    docker cp migrations/sprint2_payment_limits.sql nexus-db:/tmp/
#    docker cp migrations/sprint3_financial_audit.sql nexus-db:/tmp/
#    docker cp migrations/sprint5_gateway_api_keys.sql nexus-db:/tmp/
#    docker cp migrations/sprint7_security_2fa.sql nexus-db:/tmp/
# 4. Executar:
#    docker exec nexus-db psql -U postgres -d nexus -f /tmp/sprint2_payment_limits.sql
#    docker exec nexus-db psql -U postgres -d nexus -f /tmp/sprint3_financial_audit.sql
#    docker exec nexus-db psql -U postgres -d nexus -f /tmp/sprint5_gateway_api_keys.sql
#    docker exec nexus-db psql -U postgres -d nexus -f /tmp/sprint7_security_2fa.sql
#
# OU de forma simplificada (ajuste o nome do container se diferente):
# ══════════════════════════════════════════════════════════════

set -e

DB_CONTAINER="nexus-db"  # Ajustar se o container tiver outro nome
DB_USER="postgres"
DB_NAME="nexus"

echo "🚀 NEXUS.IA — Rodando Migrations dos Sprints 2-8"
echo "================================================="

for f in migrations/sprint2_payment_limits.sql \
         migrations/sprint3_financial_audit.sql \
         migrations/sprint5_gateway_api_keys.sql \
         migrations/sprint7_security_2fa.sql; do

    if [ -f "$f" ]; then
        echo ""
        echo "📦 Executando: $f"
        docker cp "$f" "$DB_CONTAINER:/tmp/$(basename $f)"
        docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -f "/tmp/$(basename $f)"
        echo "✅ $f — OK"
    else
        echo "⚠️ Arquivo não encontrado: $f"
    fi
done

echo ""
echo "🎉 Todas as migrations foram executadas!"
echo ""
echo "Verificando tabelas criadas:"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "\dt *payment*; \dt *gateway*; \dt *security*; \dt *audit*;"
