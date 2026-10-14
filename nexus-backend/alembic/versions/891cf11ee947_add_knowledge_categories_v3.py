"""add_knowledge_categories_v3

Revision ID: 891cf11ee947
Revises: s1_studio_templates
Create Date: 2026-04-28 16:00:34.318922
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '891cf11ee947'
down_revision: Union[str, None] = 's1_studio_templates'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── knowledge_categories ──────────────────────────────────────────────────
    op.create_table('knowledge_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(length=10), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_knowledge_categories_id'), 'knowledge_categories', ['id'], unique=False)
    op.create_index('ix_knowledge_category_company_slug', 'knowledge_categories', ['company_id', 'slug'], unique=True)

    # ── agent_memory ───────────────────────────────────────────────────────────
    op.add_column('agent_memory', sa.Column('category_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_agent_memory_category', 'agent_memory', 'knowledge_categories', ['category_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_agent_memory_category', 'agent_memory', type_='foreignkey')
    op.drop_column('agent_memory', 'category_id')
    op.drop_table('knowledge_categories')
    op.drop_index('ix_niche_profiles_company_id', table_name='niche_profiles')
    op.drop_index('ix_niche_profiles_id', table_name='niche_profiles')
    op.drop_table('niche_profiles')
    op.drop_index('ix_meta_campaign_company', table_name='meta_campaigns')
    op.drop_index('ix_meta_campaign_status', table_name='meta_campaigns')
    op.drop_table('meta_campaigns')
    op.drop_index('ix_mkt_modules_company', table_name='company_marketing_modules')
    op.drop_table('company_marketing_modules')
    op.drop_index('ix_public_bids_company_id', table_name='public_bids')
    op.drop_index('ix_public_bids_id', table_name='public_bids')
    op.drop_table('public_bids')
    op.drop_index('ix_brand_kit_company', table_name='brand_kits')
    op.drop_table('brand_kits')
    op.drop_index('ix_public_bid_alerts_company_id', table_name='public_bid_alerts')
    op.drop_index('ix_public_bid_alerts_id', table_name='public_bid_alerts')
    op.drop_table('public_bid_alerts')
    op.drop_index('ix_studio_usage_company', table_name='studio_usage')
    op.drop_table('studio_usage')
    op.drop_index('ix_studio_templates_id', table_name='studio_templates')
    op.drop_index('ix_studio_tpl_format', table_name='studio_templates')
    op.drop_index('ix_studio_tpl_premium', table_name='studio_templates')
    op.drop_index('ix_studio_tpl_status_cat', table_name='studio_templates')
    op.drop_table('studio_templates')
    op.drop_index('ix_public_bid_topics_id', table_name='public_bid_topics')
    op.drop_table('public_bid_topics')
    op.drop_index('ix_public_bid_actions_company_id', table_name='public_bid_actions')
    op.drop_index('ix_public_bid_actions_id', table_name='public_bid_actions')
    op.drop_table('public_bid_actions')
    op.drop_index('ix_conversations_external_id', table_name='conversations')
    op.drop_index('ix_conversations_id', table_name='conversations')
    op.drop_index('ix_conversations_tenant_id', table_name='conversations')
    op.drop_table('conversations')
    op.drop_index('ix_conversation_messages_id', table_name='conversation_messages')
    op.drop_table('conversation_messages')
    op.drop_index('ix_public_bid_analyses_company_id', table_name='public_bid_analyses')
    op.drop_index('ix_public_bid_analyses_id', table_name='public_bid_analyses')
    op.drop_table('public_bid_analyses')
    op.add_column('agent_memory', sa.Column('category_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'agent_memory', 'knowledge_categories', ['category_id'], ['id'])
    op.add_column('ai_token_balances', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.alter_column('ai_token_balances', 'provider',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=False,
               existing_server_default=sa.text("'any'::text"))
    op.alter_column('ai_token_balances', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.drop_index('idx_ai_tok_bal_company', table_name='ai_token_balances')
    op.alter_column('ai_token_packs', 'name',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=False)
    op.alter_column('ai_token_packs', 'badge_text',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=True)
    op.alter_column('ai_token_packs', 'provider',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=False,
               existing_server_default=sa.text("'any'::text"))
    op.alter_column('ai_token_packs', 'tier',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=False,
               existing_server_default=sa.text("'free'::text"))
    op.alter_column('ai_token_packs', 'color',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=True,
               existing_server_default=sa.text("'#a78bfa'::text"))
    op.alter_column('ai_token_packs', 'icon',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=True,
               existing_server_default=sa.text("'zap'::text"))
    op.alter_column('ai_token_packs', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('ai_token_transactions', 'provider',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=False)
    op.alter_column('ai_token_transactions', 'model',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=True)
    op.alter_column('ai_token_transactions', 'tx_type',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=False,
               existing_server_default=sa.text("'usage'::text"))
    op.alter_column('ai_token_transactions', 'source',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=True)
    op.alter_column('ai_token_transactions', 'reference_id',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=True)
    op.alter_column('ai_token_transactions', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.drop_index('idx_ai_tok_tx_company', table_name='ai_token_transactions')
    op.drop_index('idx_ai_tok_tx_created', table_name='ai_token_transactions')
    op.alter_column('deposit_records', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.create_index(op.f('ix_deposit_records_id'), 'deposit_records', ['id'], unique=False)
    op.alter_column('payment_charges', 'metadata',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               type_=sa.JSON(),
               existing_nullable=True,
               existing_server_default=sa.text("'{}'::jsonb"))
    op.alter_column('payment_charges', 'webhook_payload_last',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               type_=sa.JSON(),
               existing_nullable=True)
    op.alter_column('payment_charges', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('payment_charges', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.create_index(op.f('ix_payment_charges_external_payment_id'), 'payment_charges', ['external_payment_id'], unique=False)
    op.create_index(op.f('ix_payment_charges_id'), 'payment_charges', ['id'], unique=False)
    op.alter_column('payment_clients', 'metadata',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               type_=sa.JSON(),
               existing_nullable=True,
               existing_server_default=sa.text("'{}'::jsonb"))
    op.alter_column('payment_clients', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('payment_clients', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.create_index(op.f('ix_payment_clients_id'), 'payment_clients', ['id'], unique=False)
    op.alter_column('payment_webhook_events', 'raw_payload',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               type_=sa.JSON(),
               existing_nullable=False)
    op.alter_column('payment_webhook_events', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.create_index(op.f('ix_payment_webhook_events_id'), 'payment_webhook_events', ['id'], unique=False)
    op.add_column('usage_logs', sa.Column('ai_cost_usd', sa.Numeric(precision=12, scale=6), server_default='0', nullable=False))
    op.add_column('users', sa.Column('document', sa.String(length=18), nullable=True))
    op.add_column('users', sa.Column('document_type', sa.String(length=4), nullable=True))
    op.add_column('users', sa.Column('birth_date', sa.Date(), nullable=True))
    op.alter_column('wallet_transactions', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.create_index(op.f('ix_wallet_transactions_id'), 'wallet_transactions', ['id'], unique=False)
    op.alter_column('wallets', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('wallets', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.create_index(op.f('ix_wallets_id'), 'wallets', ['id'], unique=False)
    op.alter_column('withdrawal_requests', 'metadata',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               type_=sa.JSON(),
               existing_nullable=True,
               existing_server_default=sa.text("'{}'::jsonb"))
    op.alter_column('withdrawal_requests', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('withdrawal_requests', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.create_index(op.f('ix_withdrawal_requests_id'), 'withdrawal_requests', ['id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_withdrawal_requests_id'), table_name='withdrawal_requests')
    op.alter_column('withdrawal_requests', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('withdrawal_requests', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('withdrawal_requests', 'metadata',
               existing_type=sa.JSON(),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True,
               existing_server_default=sa.text("'{}'::jsonb"))
    op.drop_index(op.f('ix_wallets_id'), table_name='wallets')
    op.alter_column('wallets', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('wallets', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.drop_index(op.f('ix_wallet_transactions_id'), table_name='wallet_transactions')
    op.alter_column('wallet_transactions', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.drop_column('users', 'birth_date')
    op.drop_column('users', 'document_type')
    op.drop_column('users', 'document')
    op.drop_column('usage_logs', 'ai_cost_usd')
    op.drop_index(op.f('ix_payment_webhook_events_id'), table_name='payment_webhook_events')
    op.alter_column('payment_webhook_events', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('payment_webhook_events', 'raw_payload',
               existing_type=sa.JSON(),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=False)
    op.drop_index(op.f('ix_payment_clients_id'), table_name='payment_clients')
    op.alter_column('payment_clients', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('payment_clients', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('payment_clients', 'metadata',
               existing_type=sa.JSON(),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True,
               existing_server_default=sa.text("'{}'::jsonb"))
    op.drop_index(op.f('ix_payment_charges_id'), table_name='payment_charges')
    op.drop_index(op.f('ix_payment_charges_external_payment_id'), table_name='payment_charges')
    op.alter_column('payment_charges', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('payment_charges', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('payment_charges', 'webhook_payload_last',
               existing_type=sa.JSON(),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True)
    op.alter_column('payment_charges', 'metadata',
               existing_type=sa.JSON(),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True,
               existing_server_default=sa.text("'{}'::jsonb"))
    op.drop_index(op.f('ix_deposit_records_id'), table_name='deposit_records')
    op.alter_column('deposit_records', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.create_index('idx_ai_tok_tx_created', 'ai_token_transactions', ['created_at'], unique=False)
    op.create_index('idx_ai_tok_tx_company', 'ai_token_transactions', ['company_id'], unique=False)
    op.alter_column('ai_token_transactions', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('ai_token_transactions', 'reference_id',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('ai_token_transactions', 'source',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('ai_token_transactions', 'tx_type',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=False,
               existing_server_default=sa.text("'usage'::text"))
    op.alter_column('ai_token_transactions', 'model',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('ai_token_transactions', 'provider',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=False)
    op.alter_column('ai_token_packs', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('ai_token_packs', 'icon',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True,
               existing_server_default=sa.text("'zap'::text"))
    op.alter_column('ai_token_packs', 'color',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True,
               existing_server_default=sa.text("'#a78bfa'::text"))
    op.alter_column('ai_token_packs', 'tier',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=False,
               existing_server_default=sa.text("'free'::text"))
    op.alter_column('ai_token_packs', 'provider',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=False,
               existing_server_default=sa.text("'any'::text"))
    op.alter_column('ai_token_packs', 'badge_text',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('ai_token_packs', 'name',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=False)
    op.create_index('idx_ai_tok_bal_company', 'ai_token_balances', ['company_id'], unique=False)
    op.alter_column('ai_token_balances', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('ai_token_balances', 'provider',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=False,
               existing_server_default=sa.text("'any'::text"))
    op.drop_column('ai_token_balances', 'created_at')
    op.drop_constraint(None, 'agent_memory', type_='foreignkey')
    op.drop_column('agent_memory', 'category_id')
    op.create_table('public_bid_analyses',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('company_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('public_bid_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('agent_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('analysis_level', postgresql.ENUM('preliminar', 'intermediaria', 'profunda', name='analysislevel'), autoincrement=False, nullable=True),
    sa.Column('executive_summary', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('adherence_score', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('adherence_level', postgresql.ENUM('baixa', 'media', 'alta', 'excelente', name='adherencelevel'), autoincrement=False, nullable=True),
    sa.Column('commercial_potential', sa.VARCHAR(length=20), autoincrement=False, nullable=True),
    sa.Column('participation_complexity', sa.VARCHAR(length=20), autoincrement=False, nullable=True),
    sa.Column('main_requirements', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('main_risks', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('documents_needed', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('recommendation', postgresql.ENUM('participar', 'avaliar_com_cautela', 'descartar', name='recommendation'), autoincrement=False, nullable=True),
    sa.Column('justification', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['public_bid_id'], ['public_bids.id'], name='public_bid_analyses_public_bid_id_fkey'),
    sa.PrimaryKeyConstraint('id', name='public_bid_analyses_pkey')
    )
    op.create_index('ix_public_bid_analyses_id', 'public_bid_analyses', ['id'], unique=False)
    op.create_index('ix_public_bid_analyses_company_id', 'public_bid_analyses', ['company_id'], unique=False)
    op.create_table('conversation_messages',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('conversation_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('direction', postgresql.ENUM('inbound', 'outbound', name='directionenum'), autoincrement=False, nullable=False),
    sa.Column('payload', sa.TEXT(), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], name='conversation_messages_conversation_id_fkey'),
    sa.PrimaryKeyConstraint('id', name='conversation_messages_pkey')
    )
    op.create_index('ix_conversation_messages_id', 'conversation_messages', ['id'], unique=False)
    op.create_table('conversations',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('tenant_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('channel', postgresql.ENUM('whatsapp', 'telegram', 'other', name='channelenum'), autoincrement=False, nullable=False),
    sa.Column('external_id', sa.VARCHAR(), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('id', name='conversations_pkey')
    )
    op.create_index('ix_conversations_tenant_id', 'conversations', ['tenant_id'], unique=False)
    op.create_index('ix_conversations_id', 'conversations', ['id'], unique=False)
    op.create_index('ix_conversations_external_id', 'conversations', ['external_id'], unique=True)
    op.create_table('public_bid_actions',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('public_bid_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('company_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('action_type', postgresql.ENUM('saved', 'discarded', 'analyzed', 'assigned', 'participate_decision', name='bidactiontype'), autoincrement=False, nullable=False),
    sa.Column('note', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('created_by', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['public_bid_id'], ['public_bids.id'], name='public_bid_actions_public_bid_id_fkey'),
    sa.PrimaryKeyConstraint('id', name='public_bid_actions_pkey')
    )
    op.create_index('ix_public_bid_actions_id', 'public_bid_actions', ['id'], unique=False)
    op.create_index('ix_public_bid_actions_company_id', 'public_bid_actions', ['company_id'], unique=False)
    op.create_table('public_bid_topics',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('public_bid_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('topic_name', sa.VARCHAR(length=150), autoincrement=False, nullable=False),
    sa.Column('topic_category', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('confidence_score', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['public_bid_id'], ['public_bids.id'], name='public_bid_topics_public_bid_id_fkey'),
    sa.PrimaryKeyConstraint('id', name='public_bid_topics_pkey')
    )
    op.create_index('ix_public_bid_topics_id', 'public_bid_topics', ['id'], unique=False)
    op.create_table('studio_templates',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('name', sa.VARCHAR(length=120), autoincrement=False, nullable=False),
    sa.Column('description', sa.VARCHAR(length=500), autoincrement=False, nullable=True),
    sa.Column('category', sa.VARCHAR(length=50), server_default=sa.text("'Marketing'::character varying"), autoincrement=False, nullable=False),
    sa.Column('format', sa.VARCHAR(length=20), server_default=sa.text("'feed'::character varying"), autoincrement=False, nullable=False),
    sa.Column('tags', postgresql.ARRAY(sa.VARCHAR()), autoincrement=False, nullable=True),
    sa.Column('is_premium', sa.BOOLEAN(), server_default=sa.text('false'), autoincrement=False, nullable=False),
    sa.Column('price_credits', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=False),
    sa.Column('thumbnail_url', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('konva_json', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), autoincrement=False, nullable=False),
    sa.Column('status', sa.VARCHAR(length=20), server_default=sa.text("'draft'::character varying"), autoincrement=False, nullable=False),
    sa.Column('created_by', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('view_count', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=False),
    sa.Column('use_count', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name='studio_templates_created_by_fkey'),
    sa.PrimaryKeyConstraint('id', name='studio_templates_pkey')
    )
    op.create_index('ix_studio_tpl_status_cat', 'studio_templates', ['status', 'category'], unique=False)
    op.create_index('ix_studio_tpl_premium', 'studio_templates', ['is_premium'], unique=False)
    op.create_index('ix_studio_tpl_format', 'studio_templates', ['format'], unique=False)
    op.create_index('ix_studio_templates_id', 'studio_templates', ['id'], unique=False)
    op.create_table('studio_usage',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('company_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('month', sa.VARCHAR(length=7), autoincrement=False, nullable=False),
    sa.Column('generations_used', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=False),
    sa.Column('generations_limit', sa.INTEGER(), server_default=sa.text('50'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], name='studio_usage_company_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='studio_usage_pkey'),
    sa.UniqueConstraint('company_id', 'month', name='studio_usage_company_id_month_key')
    )
    op.create_index('ix_studio_usage_company', 'studio_usage', ['company_id'], unique=False)
    op.create_table('public_bid_alerts',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('company_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('name', sa.VARCHAR(length=200), autoincrement=False, nullable=False),
    sa.Column('niche_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('state', sa.VARCHAR(length=2), autoincrement=False, nullable=True),
    sa.Column('municipality', sa.VARCHAR(length=150), autoincrement=False, nullable=True),
    sa.Column('modality', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('min_value', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('max_value', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('score_min', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('only_with_edital', sa.BOOLEAN(), autoincrement=False, nullable=True),
    sa.Column('only_city_halls', sa.BOOLEAN(), autoincrement=False, nullable=True),
    sa.Column('keywords', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('delivery_channel', postgresql.ENUM('dashboard', 'email', 'whatsapp', 'telegram', name='deliverychannel'), autoincrement=False, nullable=True),
    sa.Column('is_active', sa.BOOLEAN(), autoincrement=False, nullable=True),
    sa.Column('created_by', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['niche_id'], ['niche_profiles.id'], name='public_bid_alerts_niche_id_fkey'),
    sa.PrimaryKeyConstraint('id', name='public_bid_alerts_pkey')
    )
    op.create_index('ix_public_bid_alerts_id', 'public_bid_alerts', ['id'], unique=False)
    op.create_index('ix_public_bid_alerts_company_id', 'public_bid_alerts', ['company_id'], unique=False)
    op.create_table('brand_kits',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('company_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('brand_name', sa.VARCHAR(length=200), autoincrement=False, nullable=False),
    sa.Column('product', sa.VARCHAR(length=500), autoincrement=False, nullable=True),
    sa.Column('niche', sa.VARCHAR(length=200), autoincrement=False, nullable=True),
    sa.Column('target_audience', sa.VARCHAR(length=300), autoincrement=False, nullable=True),
    sa.Column('city_region', sa.VARCHAR(length=200), autoincrement=False, nullable=True),
    sa.Column('logo_url', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('color_primary', sa.VARCHAR(length=7), autoincrement=False, nullable=True),
    sa.Column('color_secondary', sa.VARCHAR(length=7), autoincrement=False, nullable=True),
    sa.Column('color_accent', sa.VARCHAR(length=7), autoincrement=False, nullable=True),
    sa.Column('color_background', sa.VARCHAR(length=7), autoincrement=False, nullable=True),
    sa.Column('font_primary', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('font_secondary', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('visual_styles', postgresql.ARRAY(sa.TEXT()), autoincrement=False, nullable=True),
    sa.Column('texture_style', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('comm_tone', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('reference_images', postgresql.ARRAY(sa.TEXT()), autoincrement=False, nullable=True),
    sa.Column('pre_prompt', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], name='brand_kits_company_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='brand_kits_pkey'),
    sa.UniqueConstraint('company_id', name='brand_kits_company_id_key')
    )
    op.create_index('ix_brand_kit_company', 'brand_kits', ['company_id'], unique=False)
    op.create_table('public_bids',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('company_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('source', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
    sa.Column('external_bid_id', sa.VARCHAR(length=200), autoincrement=False, nullable=False),
    sa.Column('source_url', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('raw_payload_json', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('organ_name', sa.VARCHAR(length=300), autoincrement=False, nullable=True),
    sa.Column('municipality', sa.VARCHAR(length=150), autoincrement=False, nullable=True),
    sa.Column('state', sa.VARCHAR(length=2), autoincrement=False, nullable=True),
    sa.Column('scope_level', postgresql.ENUM('municipal', 'state', 'federal', name='scopelevel'), autoincrement=False, nullable=True),
    sa.Column('title', sa.VARCHAR(length=500), autoincrement=False, nullable=True),
    sa.Column('object_text', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('modality', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('estimated_value', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('publication_date', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('deadline_date', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('status', sa.VARCHAR(length=50), autoincrement=False, nullable=True),
    sa.Column('has_edital', sa.BOOLEAN(), autoincrement=False, nullable=True),
    sa.Column('adherence_score', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('adherence_level', postgresql.ENUM('baixa', 'media', 'alta', 'excelente', name='adherencelevel'), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
    sa.Column('edital_text', sa.TEXT(), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('id', name='public_bids_pkey')
    )
    op.create_index('ix_public_bids_id', 'public_bids', ['id'], unique=False)
    op.create_index('ix_public_bids_company_id', 'public_bids', ['company_id'], unique=False)
    op.create_table('company_marketing_modules',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('company_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('has_brand_kit', sa.BOOLEAN(), server_default=sa.text('false'), autoincrement=False, nullable=False),
    sa.Column('has_studio', sa.BOOLEAN(), server_default=sa.text('false'), autoincrement=False, nullable=False),
    sa.Column('has_traffic_pro', sa.BOOLEAN(), server_default=sa.text('false'), autoincrement=False, nullable=False),
    sa.Column('has_ig_campaigns', sa.BOOLEAN(), server_default=sa.text('false'), autoincrement=False, nullable=False),
    sa.Column('studio_limit', sa.INTEGER(), server_default=sa.text('50'), autoincrement=False, nullable=False),
    sa.Column('meta_accounts_limit', sa.INTEGER(), server_default=sa.text('1'), autoincrement=False, nullable=False),
    sa.Column('activated_by', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('notes', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['activated_by'], ['users.id'], name='company_marketing_modules_activated_by_fkey'),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], name='company_marketing_modules_company_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='company_marketing_modules_pkey'),
    sa.UniqueConstraint('company_id', name='company_marketing_modules_company_id_key')
    )
    op.create_index('ix_mkt_modules_company', 'company_marketing_modules', ['company_id'], unique=False)
    op.create_table('meta_campaigns',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('company_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('meta_campaign_id', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('meta_adset_id', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('meta_ad_id', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('meta_ad_account', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('name', sa.VARCHAR(length=300), autoincrement=False, nullable=False),
    sa.Column('objective', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('status', sa.VARCHAR(length=50), server_default=sa.text("'draft'::character varying"), autoincrement=False, nullable=False),
    sa.Column('budget_daily', sa.NUMERIC(precision=10, scale=2), autoincrement=False, nullable=True),
    sa.Column('start_date', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('end_date', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('location_lat', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('location_lng', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('location_radius', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('location_name', sa.VARCHAR(length=300), autoincrement=False, nullable=True),
    sa.Column('target_audience', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('ai_strategy', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('pdf_report_url', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('approved_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('approved_by', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('last_metrics', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('last_metrics_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['approved_by'], ['users.id'], name='meta_campaigns_approved_by_fkey'),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], name='meta_campaigns_company_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='meta_campaigns_pkey')
    )
    op.create_index('ix_meta_campaign_status', 'meta_campaigns', ['status'], unique=False)
    op.create_index('ix_meta_campaign_company', 'meta_campaigns', ['company_id'], unique=False)
    op.create_table('niche_profiles',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('company_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('name', sa.VARCHAR(length=200), autoincrement=False, nullable=False),
    sa.Column('positive_keywords_json', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('negative_keywords_json', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('cnaes_json', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('preferred_organs_json', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('preferred_regions_json', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('ideal_value_min', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('ideal_value_max', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('id', name='niche_profiles_pkey')
    )
    op.create_index('ix_niche_profiles_id', 'niche_profiles', ['id'], unique=False)
    op.create_index('ix_niche_profiles_company_id', 'niche_profiles', ['company_id'], unique=False)
    op.drop_index(op.f('ix_skill_installs_id'), table_name='skill_installs')
    op.drop_index('ix_skill_installs_company_skill', table_name='skill_installs')
    op.drop_index(op.f('ix_skill_installs_company_id'), table_name='skill_installs')
    op.drop_table('skill_installs')
    op.drop_index(op.f('ix_agent_installs_id'), table_name='agent_installs')
    op.drop_index(op.f('ix_agent_installs_company_id'), table_name='agent_installs')
    op.drop_index('ix_agent_installs_company_agent', table_name='agent_installs')
    op.drop_table('agent_installs')
    op.drop_index('ix_platform_skills_slug', table_name='platform_skills')
    op.drop_index(op.f('ix_platform_skills_id'), table_name='platform_skills')
    op.drop_table('platform_skills')
    op.drop_index('ix_platform_agents_slug', table_name='platform_agents')
    op.drop_index(op.f('ix_platform_agents_id'), table_name='platform_agents')
    op.drop_table('platform_agents')
    op.drop_index('ix_credit_tx_company_created', table_name='credit_transactions')
    op.drop_index(op.f('ix_credit_transactions_id'), table_name='credit_transactions')
    op.drop_index(op.f('ix_credit_transactions_company_id'), table_name='credit_transactions')
    op.drop_table('credit_transactions')
    op.drop_index(op.f('ix_user_credits_id'), table_name='user_credits')
    op.drop_index('ix_user_credits_company', table_name='user_credits')
    op.drop_table('user_credits')
    op.drop_index('ix_platform_model_costs_provider', table_name='platform_model_costs')
    op.drop_index(op.f('ix_platform_model_costs_id'), table_name='platform_model_costs')
    op.drop_table('platform_model_costs')
    op.drop_index('ix_knowledge_category_company_slug', table_name='knowledge_categories')
    op.drop_index(op.f('ix_knowledge_categories_id'), table_name='knowledge_categories')
    op.drop_table('knowledge_categories')
    op.drop_table('platform_settings')
    op.drop_index(op.f('ix_platform_api_keys_id'), table_name='platform_api_keys')
    op.drop_table('platform_api_keys')
    op.drop_index('ix_plans_name_active', table_name='plans')
    op.drop_index(op.f('ix_plans_id'), table_name='plans')
    op.drop_table('plans')
    # ### end Alembic commands ###
