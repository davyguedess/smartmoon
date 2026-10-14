import asyncio
from sqlalchemy import text
from app.db.session import async_engine

async def run():
    async with async_engine.begin() as conn:
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS document VARCHAR(18)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS document_type VARCHAR(4)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE"))
        await conn.execute(text("CREATE TABLE IF NOT EXISTS platform_settings (key VARCHAR(100) PRIMARY KEY, value TEXT, updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())"))
        for k, v in [
            ("smtp_enabled", "false"), ("smtp_host", ""), ("smtp_port", "587"),
            ("smtp_username", ""), ("smtp_password", ""), ("smtp_from_email", ""),
            ("smtp_from_name", "NEXUS.IA"),
            ("terms_of_service", "Termos de uso da plataforma NEXUS.IA. Este documento sera atualizado pelo administrador."),
            ("privacy_policy", "Politica de privacidade da plataforma NEXUS.IA. Este documento sera atualizado pelo administrador."),
        ]:
            await conn.execute(text("INSERT INTO platform_settings (key, value) VALUES (:k, :v) ON CONFLICT (key) DO NOTHING"), {"k": k, "v": v})
    print("Migration OK")

asyncio.run(run())
