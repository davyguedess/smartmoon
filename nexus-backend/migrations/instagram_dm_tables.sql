-- ============================================
-- Instagram DM Integration — Database Tables
-- Mirrors whatsapp_conversations / whatsapp_messages
-- ============================================

CREATE TABLE IF NOT EXISTS instagram_conversations (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    integration_id INT NOT NULL REFERENCES integrations(id),
    ig_user_id VARCHAR(100) NOT NULL,
    username VARCHAR(255),
    display_name VARCHAR(255),
    profile_pic_url TEXT,
    current_agent_id INT,
    status VARCHAR(30) DEFAULT 'active',
    metadata_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ig_user_id, integration_id)
);

CREATE TABLE IF NOT EXISTS instagram_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL REFERENCES instagram_conversations(id),
    direction VARCHAR(10) NOT NULL,
    sender_type VARCHAR(20) DEFAULT 'user',
    message_type VARCHAR(30) DEFAULT 'text',
    content_text TEXT,
    content_json JSONB,
    media_url TEXT,
    media_mime VARCHAR(100),
    ig_message_id VARCHAR(255),
    delivery_status VARCHAR(30),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ig_conv_company ON instagram_conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_ig_conv_integration ON instagram_conversations(integration_id);
CREATE INDEX IF NOT EXISTS idx_ig_conv_ig_user ON instagram_conversations(ig_user_id);
CREATE INDEX IF NOT EXISTS idx_ig_msg_conv ON instagram_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ig_msg_created ON instagram_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_msg_mid ON instagram_messages(ig_message_id);
