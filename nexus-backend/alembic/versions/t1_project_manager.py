"""add project manager models

Revision ID: t1_project_manager
Revises: fcfe217c42c0
Create Date: 2026-05-24 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 't1_project_manager'
down_revision = 'fcfe217c42c0'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # ── Projects ──
    op.create_table('projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=300), nullable=False),
        sa.Column('slug', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('meta_goal', sa.String(length=500), nullable=True),
        sa.Column('deadline', sa.Date(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=True),
        sa.Column('whatsapp_instance_id', sa.Integer(), nullable=True),
        sa.Column('whatsapp_group_id', sa.String(length=100), nullable=True),
        sa.Column('agent_profile_id', sa.Integer(), nullable=True),
        sa.Column('flow_id', sa.Integer(), nullable=True),
        sa.Column('agent_enabled', sa.Boolean(), nullable=True),
        sa.Column('agent_schedule_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('agent_model', sa.String(length=100), nullable=True),
        sa.Column('agent_provider', sa.String(length=50), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['agent_profile_id'], ['agent_profiles.id'], ),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['flow_id'], ['flows.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_projects_company', 'projects', ['company_id'], unique=False)
    op.create_index('ix_projects_slug', 'projects', ['slug'], unique=True)

    # ── Project Phases ──
    op.create_table('project_phases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=True),
        sa.Column('color', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_project_phases_project', 'project_phases', ['project_id'], unique=False)

    # ── Project Members ──
    op.create_table('project_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('phone_number', sa.String(length=30), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=True),
        sa.Column('responsibilities', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('last_dashboard_access', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_whatsapp_activity', sa.DateTime(timezone=True), nullable=True),
        sa.Column('tasks_completed_count', sa.Integer(), nullable=True),
        sa.Column('tasks_overdue_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_project_members_phone', 'project_members', ['project_id', 'phone_number'], unique=True)
    op.create_index('ix_project_members_project', 'project_members', ['project_id'], unique=False)

    # ── Project Tasks ──
    op.create_table('project_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('phase_id', sa.Integer(), nullable=True),
        sa.Column('step_number', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('focus', sa.Text(), nullable=True),
        sa.Column('responsible_member_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=True),
        sa.Column('priority', sa.String(length=20), nullable=True),
        sa.Column('depends_on_task_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('progress_percent', sa.Integer(), nullable=True),
        sa.Column('estimated_hours', sa.Float(), nullable=True),
        sa.Column('actual_hours', sa.Float(), nullable=True),
        sa.Column('deliverables', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('completed_by_member_id', sa.Integer(), nullable=True),
        sa.Column('completion_method', sa.String(length=20), nullable=True),
        sa.Column('completion_notes', sa.Text(), nullable=True),
        sa.Column('evidence_file_paths', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['completed_by_member_id'], ['project_members.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['phase_id'], ['project_phases.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_project_tasks_project', 'project_tasks', ['project_id'], unique=False)
    op.create_index('ix_project_tasks_status', 'project_tasks', ['project_id', 'status'], unique=False)

    # ── Project Subtasks ──
    op.create_table('project_subtasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('is_done', sa.Boolean(), nullable=True),
        sa.Column('done_by_member_id', sa.Integer(), nullable=True),
        sa.Column('done_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['done_by_member_id'], ['project_members.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['task_id'], ['project_tasks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # ── Project Meetings ──
    op.create_table('project_meetings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('audio_file_path', sa.String(length=500), nullable=True),
        sa.Column('audio_size_bytes', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('topic_markers_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('participants_detected', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('tasks_created_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('decisions_logged_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('shared_to_whatsapp_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_member_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['created_by_member_id'], ['project_members.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_project_meetings_project', 'project_meetings', ['project_id'], unique=False)

    # ── Project Decisions ──
    op.create_table('project_decisions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('meeting_id', sa.Integer(), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('decided_by', sa.String(length=200), nullable=True),
        sa.Column('context', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['meeting_id'], ['project_meetings.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # ── Project Comments ──
    op.create_table('project_comments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False),
        sa.Column('member_id', sa.Integer(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('source', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['member_id'], ['project_members.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['task_id'], ['project_tasks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # ── Project Files ──
    op.create_table('project_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=True),
        sa.Column('meeting_id', sa.Integer(), nullable=True),
        sa.Column('member_id', sa.Integer(), nullable=True),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_name', sa.String(length=300), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('file_type', sa.String(length=30), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['meeting_id'], ['project_meetings.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['member_id'], ['project_members.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['task_id'], ['project_tasks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # ── Project Alerts ──
    op.create_table('project_alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('alert_type', sa.String(length=30), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('severity', sa.String(length=20), nullable=True),
        sa.Column('resolved', sa.Boolean(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # ── Project Daily Reports ──
    op.create_table('project_daily_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('report_date', sa.Date(), nullable=False),
        sa.Column('report_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('report_text', sa.Text(), nullable=True),
        sa.Column('sent_to_whatsapp', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_daily_reports_project_date', 'project_daily_reports', ['project_id', 'report_date'], unique=True)

    # ── Project OTP Codes ──
    op.create_table('project_otp_codes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('phone_number', sa.String(length=30), nullable=False),
        sa.Column('code', sa.String(length=6), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # ── Project Member Sessions ──
    op.create_table('project_member_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('member_id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['member_id'], ['project_members.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_project_member_sessions_token_hash'), 'project_member_sessions', ['token_hash'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_project_member_sessions_token_hash'), table_name='project_member_sessions')
    op.drop_table('project_member_sessions')
    op.drop_table('project_otp_codes')
    op.drop_index('ix_daily_reports_project_date', table_name='project_daily_reports')
    op.drop_table('project_daily_reports')
    op.drop_table('project_alerts')
    op.drop_table('project_files')
    op.drop_table('project_comments')
    op.drop_table('project_decisions')
    op.drop_index('ix_project_meetings_project', table_name='project_meetings')
    op.drop_table('project_meetings')
    op.drop_table('project_subtasks')
    op.drop_index('ix_project_tasks_status', table_name='project_tasks')
    op.drop_index('ix_project_tasks_project', table_name='project_tasks')
    op.drop_table('project_tasks')
    op.drop_index('ix_project_members_project', table_name='project_members')
    op.drop_index('ix_project_members_phone', table_name='project_members')
    op.drop_table('project_members')
    op.drop_index('ix_project_phases_project', table_name='project_phases')
    op.drop_table('project_phases')
    op.drop_index('ix_projects_slug', table_name='projects')
    op.drop_index('ix_projects_company', table_name='projects')
    op.drop_table('projects')
