"""add_user_registration_fields_and_platform_settings

Add document, document_type, birth_date columns to users table.
Add platform_settings table for SMTP/terms configuration.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'b1c2d3e4f5g6'
down_revision = None  # idempotent — runs via DO $$ blocks
branch_labels = None
depends_on = None


def upgrade():
    # Add registration fields to users table
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE users ADD COLUMN document VARCHAR(18);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE users ADD COLUMN document_type VARCHAR(4);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE users ADD COLUMN birth_date DATE;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)

    # Create platform_settings table
    op.execute("""
        CREATE TABLE IF NOT EXISTS platform_settings (
            key VARCHAR(100) PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """)

    # Seed default settings
    op.execute("""
        INSERT INTO platform_settings (key, value) VALUES
            ('smtp_enabled', 'false'),
            ('smtp_host', ''),
            ('smtp_port', '587'),
            ('smtp_username', ''),
            ('smtp_password', ''),
            ('smtp_from_email', ''),
            ('smtp_from_name', 'NEXUS.IA'),
            ('terms_of_service', 'Termos de uso da plataforma NEXUS.IA. Este documento será atualizado pelo administrador.'),
            ('privacy_policy', 'Política de privacidade da plataforma NEXUS.IA. Este documento será atualizado pelo administrador.')
        ON CONFLICT (key) DO NOTHING;
    """)


def downgrade():
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS document")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS document_type")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS birth_date")
    op.execute("DROP TABLE IF EXISTS platform_settings")
