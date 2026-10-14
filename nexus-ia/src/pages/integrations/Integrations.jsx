import { useState, useEffect, useRef } from 'react'
import { Save, TestTube, Eye, EyeOff, ChevronDown, ChevronRight, ExternalLink, Check, Database, HardDrive, Zap, Upload, FileJson, RefreshCw, CheckCircle2, AlertTriangle, Link2, Unlink, Trash2, Plus } from 'lucide-react'
import { api } from '../../api'
import ConnectionsPanel from './Connections'

// ── Brand SVG Icons ──────────────────────────────────────
const Icons = {
  whatsapp: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#25D366"/>
      <path d="M22.5 9.5A9.17 9.17 0 0 0 16 7a9.17 9.17 0 0 0-7.94 13.74L7 25l4.38-1.15A9.17 9.17 0 0 0 25 16.08 9.17 9.17 0 0 0 22.5 9.5Zm-6.5 14.1a7.62 7.62 0 0 1-3.88-1.06l-.28-.17-2.89.76.77-2.82-.18-.29A7.62 7.62 0 1 1 16 23.6Zm4.18-5.7c-.23-.12-1.36-.67-1.57-.75s-.36-.12-.52.12-.59.75-.72.9-.27.17-.5.06a6.26 6.26 0 0 1-1.85-1.14 6.93 6.93 0 0 1-1.28-1.59c-.13-.23 0-.35.1-.47s.23-.27.34-.4a1.55 1.55 0 0 0 .23-.38.42.42 0 0 0-.02-.4c-.06-.12-.52-1.25-.71-1.71s-.38-.39-.52-.39h-.44a.85.85 0 0 0-.61.28 2.58 2.58 0 0 0-.8 1.92 4.48 4.48 0 0 0 .94 2.37 10.27 10.27 0 0 0 3.93 3.47c.55.24 .98.38 1.31.49a3.15 3.15 0 0 0 1.45.09 2.37 2.37 0 0 0 1.55-1.09 1.92 1.92 0 0 0 .13-1.09c-.05-.09-.19-.15-.42-.27Z" fill="white"/>
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#229ED9"/>
      <path d="M23.9 9.2 6.4 15.9c-1.2.5-1.2 1.1-.2 1.4l4.5 1.4 10.4-6.6c.5-.3.9-.1.5.2l-8.4 7.6h-.01l.3 4.7c.4 0 .6-.2.8-.4l2-1.9 4.2 3.1c.8.4 1.3.2 1.5-.7L25 10.3c.3-1.2-.4-1.7-1.1-1.1Z" fill="white"/>
    </svg>
  ),
  openai: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#10A37F"/>
      <path d="M23.4 13.9a5.3 5.3 0 0 0-.46-4.36 5.4 5.4 0 0 0-5.8-2.6A5.4 5.4 0 0 0 13.1 5a5.4 5.4 0 0 0-5.14 3.73 5.4 5.4 0 0 0-3.62 2.62 5.4 5.4 0 0 0 .67 6.34 5.3 5.3 0 0 0 .46 4.36 5.4 5.4 0 0 0 5.8 2.6A5.4 5.4 0 0 0 15.27 27a5.4 5.4 0 0 0 5.15-3.74 5.4 5.4 0 0 0 3.61-2.62 5.4 5.4 0 0 0-.63-6.74ZM15.27 25.38a4 4 0 0 1-2.57-.93l.13-.07 4.27-2.46a.71.71 0 0 0 .36-.62v-6.01l1.8 1.04a.07.07 0 0 1 .04.05v4.97a4 4 0 0 1-4.03 4.03Zm-8.64-3.67a4 4 0 0 1-.47-2.69l.12.07 4.27 2.47a.71.71 0 0 0 .71 0l5.22-3.01v2.08a.07.07 0 0 1-.03.06l-4.32 2.49a4 4 0 0 1-5.5-1.47ZM5.87 12.6a4 4 0 0 1 2.1-1.76v5.07a.71.71 0 0 0 .35.62l5.2 3-1.8 1.04a.07.07 0 0 1-.07 0L7.35 18.1a4 4 0 0 1-1.48-5.5Zm14.8 3.44-5.22-3.01 1.8-1.04a.07.07 0 0 1 .07 0l4.3 2.48a4 4 0 0 1-.62 7.22v-5.07a.71.71 0 0 0-.33-.58Zm1.79-2.7-.12-.08-4.27-2.47a.71.71 0 0 0-.71 0l-5.22 3.01v-2.08a.07.07 0 0 1 .03-.06l4.32-2.49a4 4 0 0 1 5.97 4.17Zm-11.31 3.72-1.8-1.04a.07.07 0 0 1-.04-.05v-4.97a4 4 0 0 1 6.56-3.07l-.13.07L11.47 10a.71.71 0 0 0-.36.62l.04 6.04Zm.98-2.12 2.32-1.34 2.33 1.34v2.67l-2.33 1.35-2.32-1.35V15Z" fill="white"/>
    </svg>
  ),
  gemini: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#4285F4"/>
      <path d="M16 7c0 5 3.99 9 9 9-5.01 0-9 4-9 9 0-5-3.99-9-9-9 5.01 0 9-4 9-9Z" fill="white"/>
    </svg>
  ),
  claude: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#D97706"/>
      <path d="M10.5 21.5 16 10l5.5 11.5h-2.1L16 13.6l-3.4 7.9h-2.1Z" fill="white"/>
      <path d="M12 19h8l-.9-2h-6.2L12 19Z" fill="white"/>
    </svg>
  ),
  groq: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#7C3AED"/>
      <path d="M16 8a8 8 0 1 0 8 8 8 8 0 0 0-8-8Zm0 13a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" fill="white"/>
      <path d="M16 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" fill="white"/>
      <path d="M20 16h4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  google: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="white" stroke="#E5E7EB" strokeWidth="1"/>
      <path d="M24.5 16.2c0-.6-.05-1.2-.16-1.7H16v3.3h4.77a4.08 4.08 0 0 1-1.77 2.68v2.22h2.87a8.68 8.68 0 0 0 2.63-6.53Z" fill="#4285F4"/>
      <path d="M16 25a8.5 8.5 0 0 0 5.87-2.15l-2.87-2.22A5.37 5.37 0 0 1 16 21.5a5.37 5.37 0 0 1-5.05-3.7H7.99v2.3A9 9 0 0 0 16 25Z" fill="#34A853"/>
      <path d="M10.95 17.8A5.4 5.4 0 0 1 10.67 16a5.4 5.4 0 0 1 .28-1.8V11.9H8a9 9 0 0 0 0 8.2l2.95-2.3Z" fill="#FBBC05"/>
      <path d="M16 10.5a4.87 4.87 0 0 1 3.44 1.35l2.57-2.57A8.65 8.65 0 0 0 16 7a9 9 0 0 0-8.02 4.9l2.97 2.3A5.37 5.37 0 0 1 16 10.5Z" fill="#EA4335"/>
    </svg>
  ),
  gmail: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="white" stroke="#E5E7EB" strokeWidth="1"/>
      <path d="M7 11.5v9A1.5 1.5 0 0 0 8.5 22H11v-7.62L16 18l5-3.62V22h2.5A1.5 1.5 0 0 0 25 20.5v-9L16 17 7 11.5Z" fill="#EA4335"/>
      <path d="M7 11.5 16 17l9-5.5V10h-1L16 14.38 8 10H7v1.5Z" fill="#D93025"/>
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="white" stroke="#E5E7EB" strokeWidth="1"/>
      <rect x="8" y="10" width="16" height="14" rx="2" fill="#1A73E8"/>
      <rect x="8" y="10" width="16" height="5" rx="1" fill="#4285F4"/>
      <circle cx="12" cy="9" r="1.5" fill="#FBBC04"/>
      <circle cx="20" cy="9" r="1.5" fill="#FBBC04"/>
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">31</text>
    </svg>
  ),
  contacts: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#34A853"/>
      <circle cx="16" cy="13" r="4" fill="white"/>
      <path d="M8 25c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#FF6D00"/>
      <rect x="9" y="18" width="3" height="6" fill="white" rx="1"/>
      <rect x="14" y="14" width="3" height="10" fill="white" rx="1"/>
      <rect x="19" y="10" width="3" height="14" fill="white" rx="1"/>
    </svg>
  ),
  elevenlabs: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#8B5CF6"/>
      <path d="M10 16c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <path d="M13 16c0-1.7 1.3-3 3-3s3 1.3 3 3-1.3 3-3 3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="16" cy="16" r="1.5" fill="white"/>
      <line x1="16" y1="22" x2="16" y2="25" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="13" y1="25" x2="19" y2="25" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  whisper: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#0EA5E9"/>
      <rect x="13" y="9" width="6" height="10" rx="3" fill="white"/>
      <path d="M10 18c0 3.3 2.7 5 6 5s6-1.7 6-5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <line x1="16" y1="23" x2="16" y2="26" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  zapi: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#7C3AED"/>
      <path d="M10 11h12l-7 5 7 5H10l7-5-7-5Z" fill="white" opacity="0.9"/>
      <circle cx="16" cy="16" r="3" fill="white"/>
    </svg>
  ),
  smartmoon: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#0EA5E9"/>
      <path d="M18 7a9 9 0 1 0 0 18 9 9 0 0 1 0-18Z" fill="white" opacity="0.9"/>
      <circle cx="21" cy="10" r="1.5" fill="white"/>
      <circle cx="23" cy="14" r="1" fill="white"/>
    </svg>
  ),
  mercadopago: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#00B1EA"/>
      <path d="M8 16C8 11.58 11.58 8 16 8c2.67 0 5.02 1.26 6.54 3.2" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M24 16c0 4.42-3.58 8-8 8a7.96 7.96 0 0 1-6.54-3.2" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M13 16l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  meta: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="16" cy="16" r="16" fill="#0082FB"/>
      <path d="M7 17.5C7 15 8.5 13 10.5 13c1 0 2 .7 3 2.1 1-1.7 2.1-2.6 3.5-2.6 2.8 0 5 3.2 5 7.1 0 1.8-.6 2.9-1.8 2.9-1 0-1.6-.8-2.2-2.4-.7 1.5-1.4 2.4-2.5 2.4-1.2 0-1.9-.9-2.6-2.3-.5 1.4-1.2 2.3-2.4 2.3C8 22.5 7 20.2 7 17.5Z" stroke="white" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="32" x2="32" y2="0">
          <stop offset="0%" stopColor="#feda75"/>
          <stop offset="25%" stopColor="#fa7e1e"/>
          <stop offset="50%" stopColor="#d62976"/>
          <stop offset="75%" stopColor="#962fbf"/>
          <stop offset="100%" stopColor="#4f5bd5"/>
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="url(#ig-grad)"/>
      <rect x="8" y="8" width="16" height="16" rx="5" stroke="white" strokeWidth="1.5" fill="none"/>
      <circle cx="16" cy="16" r="4" stroke="white" strokeWidth="1.5" fill="none"/>
      <circle cx="22" cy="10" r="1.2" fill="white"/>
    </svg>
  ),
}

// Providers whose api_key field should be saved to the backend DB (encrypted)
const DB_PROVIDERS = ['openai', 'gemini', 'claude', 'groq', 'elevenlabs', 'telegram', 'whatsapp', 'meta_ads']

// ── All integration definitions ──────────────────────────
const SECTIONS = [
  {
    id: 'messaging',
    title: 'Mensageria',
    emoji: '💬',
    color: '#25D366',
    integrations: [
      {
        key: 'smartmoon', name: 'WhatsApp Direto (SmartMoon)', icon: 'smartmoon', color: '#0EA5E9',
        description: 'Motor WhatsApp próprio — sem taxas por número, anti-ban inteligente, infraestrutura privada',
        fields: [],
        note: 'Crie instâncias abaixo. Escaneie o QR Code para conectar — sem dependência de terceiros.',
      },
      {
        key: 'telegram', name: 'Telegram Bot', icon: 'telegram', color: '#229ED9',
        description: 'Gerencie múltiplos bots Telegram — cada bot com seu próprio fluxo independente',
        fields: [],
        note: 'Adicione seus bots abaixo. Cada bot precisa de um token válido do @BotFather.',
      },
      {
        key: 'instagram_dm', name: 'Instagram DM', icon: 'instagram', color: '#E4405F',
        description: 'Atenda DMs do Instagram automaticamente — IA responde via Meta Graph API oficial',
        oauth: true,
        customCard: true,
        oauthUrl: '/integrations/instagram/auth-url',
        fields: [],
        note: 'Conecte sua conta Instagram Business/Creator via login Meta. Requer Facebook Page vinculada.',
      },
    ],
  },
  {
    id: 'google',
    title: 'Google Cloud',
    emoji: '🔵',
    color: '#4285F4',
    integrations: [
      {
        key: 'google_oauth', name: 'Google OAuth2', icon: 'google', color: '#4285F4',
        description: 'Autorize o Smart Moon a acessar Gmail, Contacts, Calendar e Sheets com um único clique',
        oauth: true,
        customCard: true,
        oauthUrl: '/google/auth',
        oauthStatusUrl: '/google/status',
        fields: [],
      },
      {
        key: 'gmail', name: 'Gmail', icon: 'gmail', color: '#EA4335',
        description: 'Agentes leem e respondem e-mails automaticamente',
        requiresGoogle: true,
        testUrl: '/google/gmail/messages?max_results=3',
        fields: [],
        info: 'Requer autorização Google OAuth2 acima',
      },
      {
        key: 'google_contacts', name: 'Google Contacts', icon: 'contacts', color: '#34A853',
        description: 'Importa contatos e separa quem tem WhatsApp de quem não tem',
        requiresGoogle: true,
        testUrl: '/google/contacts?max_results=5',
        fields: [],
        info: 'Requer autorização Google OAuth2',
      },
      {
        key: 'google_calendar', name: 'Google Calendar', icon: 'calendar', color: '#1A73E8',
        description: 'Crie e consulte eventos automaticamente via IA',
        requiresGoogle: true,
        testUrl: '/google/calendar/events?max_results=3',
        fields: [],
        info: 'Requer autorização Google OAuth2',
      },
      {
        key: 'google_analytics', name: 'Google Analytics GA4', icon: 'analytics', color: '#FF6D00',
        description: 'Alertas automáticos quando conversão cai abaixo do threshold',
        requiresGoogle: true,
        fields: [
          { id: 'property_id', label: 'GA4 Property ID', placeholder: '123456789', secret: false },
        ],
      },
    ],
  },
  {
    id: 'ai',
    title: 'Provedores de IA',
    emoji: '🤖',
    color: '#10A37F',
    integrations: [
      {
        key: 'openai', name: 'OpenAI GPT-4o', icon: 'openai', color: '#10A37F',
        description: 'Respostas avançadas, análise de documentos, geração de conteúdo',
        fields: [
          { id: 'api_key', label: 'OpenAI API Key', placeholder: 'sk-proj-...', secret: true, hint: 'platform.openai.com/api-keys' },
          { id: 'model', label: 'Modelo padrão', placeholder: 'gpt-4o', secret: false },
        ],
      },
      {
        key: 'gemini', name: 'Google Gemini', icon: 'gemini', color: '#4285F4',
        description: 'Análise multimodal: imagens, PDFs, áudio com um único modelo',
        fields: [
          { id: 'api_key', label: 'Gemini API Key', placeholder: 'AIzaSy...', secret: true, hint: 'aistudio.google.com/app/apikey' },
          { id: 'model', label: 'Modelo', placeholder: 'gemini-1.5-pro', secret: false },
        ],
      },
      {
        key: 'claude', name: 'Anthropic Claude', icon: 'claude', color: '#D97706',
        description: 'Análise de documentos longos, raciocínio complexo, textos jurídicos',
        fields: [
          { id: 'api_key', label: 'Anthropic API Key', placeholder: 'sk-ant-api03-...', secret: true, hint: 'console.anthropic.com/settings/keys' },
          { id: 'model', label: 'Modelo', placeholder: 'claude-3-5-sonnet-20241022', secret: false },
        ],
      },
      {
        key: 'groq', name: 'Groq Ultra-Rápido', icon: 'groq', color: '#7C3AED',
        description: 'Inferência 10-100× mais rápida. Llama3 70B em milissegundos',
        fields: [
          { id: 'api_key', label: 'Groq API Key', placeholder: 'gsk_...', secret: true, hint: 'console.groq.com/keys' },
          { id: 'model', label: 'Modelo', placeholder: 'llama3-70b-8192', secret: false },
        ],
      },
    ],
  },
  {
    id: 'voice',
    title: 'Voz & Áudio',
    emoji: '🎙️',
    color: '#8B5CF6',
    integrations: [
      {
        key: 'elevenlabs', name: 'ElevenLabs TTS', icon: 'elevenlabs', color: '#8B5CF6',
        description: 'Converte respostas da IA em áudio realista e envia como voz no WhatsApp',
        fields: [
          { id: 'api_key', label: 'ElevenLabs API Key', placeholder: 'sk_...', secret: true, hint: 'elevenlabs.io/app/speech-synthesis → API' },
          { id: 'voice_id', label: 'Voice ID (PT-BR)', placeholder: 'onwK4e9ZLuTAKqWW03F9', secret: false, hint: 'ID da voz em Português' },
        ],
      },
      {
        key: 'whisper', name: 'OpenAI Whisper STT', icon: 'whisper', color: '#0EA5E9',
        description: 'Transcreve áudios do WhatsApp e Telegram antes de enviar para o agente',
        fields: [
          { id: 'language', label: 'Idioma padrão', placeholder: 'pt', secret: false, hint: 'pt = Português, en = Inglês' },
        ],
        note: 'Utiliza a mesma chave da OpenAI — sem configuração extra necessária',
      },
    ],
  },
  {
    id: 'meta',
    title: 'Mídia & Tráfego',
    emoji: '📢',
    color: '#0082FB',
    integrations: [
      {
        key: 'meta_ads', name: 'Meta Ads (Facebook & Instagram)', icon: 'meta', color: '#0082FB',
        description: 'Conecte Facebook & Instagram — Brand Kit, campanhas, análise de marca via Graph API',
        fields: [
          { id: 'app_id', label: 'App ID', placeholder: '123456789012345', secret: false, hint: 'developers.facebook.com → Meus Apps → ID do App' },
          { id: 'api_key', label: 'Access Token', placeholder: 'EAAxxxxx...', secret: true, hint: 'Token de longa duração do Business Manager' },
          { id: 'ad_account_id', label: 'Ad Account ID', placeholder: 'act_123456789', secret: false, hint: 'Business Manager → Configurações → Contas de anúncios' },
          { id: 'ig_user_id', label: 'Instagram Business ID', placeholder: '17841400...', secret: false, hint: 'Graph API Explorer → GET /me/accounts → instagram_business_account' },
        ],
        testMeta: true,
      },
    ],
  },
  {
    id: 'storage',
    title: 'Memória & Armazenamento',
    emoji: '🗄️',
    color: '#6366F1',
    integrations: [
      {
        key: 'google_drive', name: 'Google Drive', icon: 'google', color: '#0F9D58',
        description: 'Salve e recupere arquivos, planilhas e documentos gerados pelos agentes diretamente no seu Drive',
        fields: [],
        requiresGoogle: true,
        testUrl: '/google/drive/files?max_results=5',
        info: 'Requer autorização Google OAuth2 (seção Google Cloud acima)',
        badge: 'OAuth Google',
      },
      {
        key: 'google_sheets', name: 'Google Sheets', icon: 'google', color: '#0F9D58',
        description: 'Leia e escreva planilhas automaticamente — relatórios, DRE, fluxo de caixa e planilhas financeiras',
        fields: [],
        requiresGoogle: true,
        testUrl: '/google/sheets/list',
        info: 'Requer autorização Google OAuth2 (seção Google Cloud acima)',
        badge: 'OAuth Google',
      },
      {
        key: 'notion', name: 'Notion', icon: 'notion', color: '#000000',
        description: 'Crie páginas, salve notas de reuniões, bases de dados e resultados de pesquisa diretamente no Notion',
        fields: [
          { id: 'api_key', label: 'Notion Integration Token', placeholder: 'secret_xxx...', secret: true, hint: 'notion.so/my-integrations → Criar integração' },
          { id: 'default_page_id', label: 'Página Raiz (ID)', placeholder: 'abc123...', secret: false, hint: 'ID da página onde os agentes criarão subpáginas' },
        ],
        badge: 'API Token',
      },
      {
        key: 's3', name: 'Amazon S3 / R2', icon: 's3', color: '#FF9900',
        description: 'Armazene arquivos, áudios, relatórios e backups em escala. Compatível com Cloudflare R2',
        fields: [
          { id: 'access_key_id', label: 'Access Key ID', placeholder: 'AKIA...', secret: true, hint: 'AWS Console → IAM → Chaves de acesso' },
          { id: 'secret_access_key', label: 'Secret Access Key', placeholder: 'xxxxx...', secret: true },
          { id: 'bucket_name', label: 'Nome do Bucket', placeholder: 'meus-arquivos-nexus', secret: false },
          { id: 'region', label: 'Região', placeholder: 'us-east-1', secret: false },
          { id: 'endpoint_url', label: 'Endpoint (R2/alternativo)', placeholder: 'https://xxx.r2.cloudflarestorage.com', secret: false, hint: 'Deixe vazio para usar AWS padrão' },
        ],
        badge: 'S3 API',
      },
      {
        key: 'onedrive', name: 'Microsoft OneDrive', icon: 'microsoft', color: '#0078D4',
        description: 'Sincronize arquivos gerados pelos agentes com o OneDrive e SharePoint da sua organização',
        fields: [
          { id: 'client_id', label: 'Azure App Client ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', secret: false, hint: 'Azure Portal → App registrations → Client ID' },
          { id: 'client_secret', label: 'Client Secret', placeholder: 'xxxxx...', secret: true },
          { id: 'tenant_id', label: 'Tenant ID', placeholder: 'xxxxxxxx-xxxx...', secret: false },
        ],
        badge: 'OAuth Azure',
        comingSoon: false,
      },
      {
        key: 'dropbox', name: 'Dropbox', icon: 'dropbox', color: '#0061FF',
        description: 'Salve automaticamente arquivos e relatórios dos agentes no seu Dropbox',
        fields: [
          { id: 'access_token', label: 'Dropbox Access Token', placeholder: 'sl.xxxxx...', secret: true, hint: 'dropbox.com/developers/apps → OAuth2 Token' },
          { id: 'folder_path', label: 'Pasta destino', placeholder: '/SMART-MOON', secret: false },
        ],
        badge: 'API Token',
      },
      {
        key: 'pinecone', name: 'Pinecone (Memória Vetorial)', icon: 'pinecone', color: '#1A1A2E',
        description: 'Base de dados vetorial para memória semântica de longo prazo. Armazene e recupere contexto com busca por similaridade',
        fields: [
          { id: 'api_key', label: 'Pinecone API Key', placeholder: 'pc-xxxxx...', secret: true, hint: 'app.pinecone.io → API Keys' },
          { id: 'index_name', label: 'Nome do Índice', placeholder: 'nexus-memory', secret: false },
          { id: 'environment', label: 'Environment', placeholder: 'gcp-starter', secret: false },
        ],
        badge: 'Vector DB',
      },
      {
        key: 'redis', name: 'Redis (Cache Rápido)', icon: 'redis', color: '#DC382D',
        description: 'Cache de contexto ultra-rápido para sessões de chat. Reduz latência e economiza tokens com cache de respostas frequentes',
        fields: [
          { id: 'url', label: 'Redis URL', placeholder: 'redis://localhost:6379', secret: true, hint: 'redis.io/docs/management/config ou Upstash' },
          { id: 'ttl_seconds', label: 'TTL do cache (segundos)', placeholder: '3600', secret: false, hint: '3600 = 1 hora de cache por sessão' },
        ],
        badge: 'Cache',
        note: 'Redis já está rodando localmente pelo docker-compose',
      },
    ],
  },
]

// ── Google OAuth Card (custom) ────────────────────────────
function GoogleOAuthCard({ integration }) {
  const [open, setOpen] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(null)
  const [credInfo, setCredInfo] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const refresh = () => {
    fetch('/google/status').then(r => r.json()).then(d => setGoogleConnected(d.connected)).catch(() => setGoogleConnected(false))
    fetch('/google/credentials-info').then(r => r.json()).then(setCredInfo).catch(() => {})
  }

  useEffect(() => { refresh() }, [])

  const uploadFile = async (file) => {
    if (!file) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/google/upload-credentials', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Erro')
      setUploadMsg({ ok: true, text: data.message, project: data.project_id })
      refresh()
    } catch (e) {
      setUploadMsg({ ok: false, text: e.message })
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => { e.preventDefault(); setDragging(false); uploadFile(e.dataTransfer.files[0]) }
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)

  const statusBadge = googleConnected === null
    ? { label: 'Verificando...', bg: 'rgba(100,100,120,0.1)', color: '#64748b', dot: '#64748b' }
    : googleConnected
    ? { label: 'Conectado', bg: 'rgba(16,185,129,0.12)', color: '#10b981', dot: '#10b981' }
    : { label: credInfo?.configured ? 'Credenciais OK — Auth pendente' : 'Não configurado', bg: credInfo?.configured ? 'rgba(245,158,11,0.12)' : 'rgba(100,100,120,0.1)', color: credInfo?.configured ? '#f59e0b' : '#64748b', dot: credInfo?.configured ? '#f59e0b' : '#6b7280' }

  return (
    <div data-tour="google-oauth-card" style={{ background: open ? 'var(--bg-card)' : 'rgba(255,255,255,0.02)', border: `1px solid ${open ? '#4285F435' : 'var(--border-subtle)'}`, borderRadius: 14, overflow: 'hidden', marginBottom: 10, transition: 'all 0.25s ease', boxShadow: open ? '0 0 0 1px #4285F418, 0 4px 24px rgba(0,0,0,0.15)' : 'none' }}>
      {/* Header */}
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', userSelect: 'none', background: open ? 'linear-gradient(90deg, #4285F408 0%, transparent 100%)' : 'transparent' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: '#4285F412', border: '1px solid #4285F425', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px #4285F415' }}>
          {Icons.google}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Google OAuth2</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {credInfo?.configured ? `Projeto: ${credInfo.project_id} · ${credInfo.client_id}` : 'Gmail, Contacts, Calendar, Sheets'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: statusBadge.bg, color: statusBadge.color, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusBadge.dot, display: 'inline-block' }} />
            {statusBadge.label}
          </span>
          <div style={{ width: 24, height: 24, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <ChevronDown size={12} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: '0 18px 20px', borderTop: '1px solid #4285F418' }}>
          {/* Step 1 — Upload JSON */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.7px', textTransform: 'uppercase', color: '#4285F4', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, background: '#4285F420', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>1</span>
              Carregar Credenciais
            </div>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? '#4285F4' : credInfo?.configured ? 'rgba(16,185,129,0.35)' : 'rgba(66,133,244,0.25)'}`, borderRadius: 12, padding: '20px 16px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', background: dragging ? 'rgba(66,133,244,0.06)' : credInfo?.configured ? 'rgba(16,185,129,0.04)' : 'rgba(66,133,244,0.03)' }}>
              <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={e => uploadFile(e.target.files[0])} />
              {credInfo?.configured ? (
                <>
                  <CheckCircle2 size={22} color="#10b981" style={{ margin: '0 auto 8px', display: 'block' }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>Credenciais configuradas</div>
                  <div style={{ fontSize: 11, color: '#4b5563', marginTop: 3 }}>Projeto: <strong style={{ color: '#94a3b8' }}>{credInfo.project_id}</strong></div>
                  <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>Arraste um novo JSON para substituir</div>
                </>
              ) : (
                <>
                  <FileJson size={22} color="#4285F4" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.7 }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Arraste o <strong>client_secret_*.json</strong> aqui</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>ou clique para selecionar o arquivo</div>
                  <div style={{ fontSize: 10, color: '#4285F4', marginTop: 6, background: 'rgba(66,133,244,0.08)', borderRadius: 6, padding: '3px 8px', display: 'inline-block' }}>Google Cloud Console → APIs … → Credenciais → Baixar JSON</div>
                </>
              )}
              {uploading && <div style={{ fontSize: 11, color: '#4285F4', marginTop: 8 }}>Enviando...</div>}
            </div>
            {uploadMsg && (
              <div style={{ marginTop: 8, padding: '9px 12px', borderRadius: 9, fontSize: 11, background: uploadMsg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', color: uploadMsg.ok ? '#10b981' : '#ef4444', border: `1px solid ${uploadMsg.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                {uploadMsg.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {uploadMsg.text}{uploadMsg.project && <> · <strong>{uploadMsg.project}</strong></>}
              </div>
            )}
          </div>

          {/* Step 2 — OAuth */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.7px', textTransform: 'uppercase', color: '#4285F4', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, background: credInfo?.configured ? '#4285F420' : 'rgba(100,100,120,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>2</span>
              Autorizar Acesso
            </div>
            <a href={credInfo?.configured ? '/google/auth' : undefined}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, textDecoration: 'none', background: googleConnected ? 'rgba(16,185,129,0.15)' : credInfo?.configured ? 'linear-gradient(135deg, #4285f4, #357ae8)' : 'rgba(100,100,120,0.12)', color: googleConnected ? '#10b981' : credInfo?.configured ? 'white' : '#6b7280', fontSize: 12, fontWeight: 700, border: googleConnected ? '1px solid rgba(16,185,129,0.3)' : 'none', boxShadow: credInfo?.configured && !googleConnected ? '0 2px 12px rgba(66,133,244,0.35)' : 'none', cursor: credInfo?.configured ? 'pointer' : 'not-allowed', opacity: credInfo?.configured ? 1 : 0.5 }}>
              {Icons.google}
              {googleConnected ? 'Google Conectado — Revogar acesso' : 'Autorizar com Google (OAuth2)'}
              {credInfo?.configured && !googleConnected && <ExternalLink size={12} />}
            </a>
            {!credInfo?.configured && (
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 7 }}>Complete o passo 1 antes de autorizar.</p>
            )}
            {credInfo?.configured && !googleConnected && (
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 7 }}>Uma aba será aberta para selecionar a conta Google e conceder permissões.</p>
            )}
            {googleConnected && (
              <p style={{ fontSize: 10, color: '#10b981', marginTop: 7, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={10} /> Gmail, Contacts, Calendar e Sheets estão autorizados.</p>
            )}
          </div>

          {/* Refresh status */}
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={refresh} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '5px 10px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}>
              <RefreshCw size={10} /> Atualizar status
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TelegramMultiBotManager ───────────────────────────────
function TelegramMultiBotManager({ color }) {
  const [bots, setBots] = useState([])
  const [flows, setFlows] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [addToken, setAddToken] = useState('')
  const [addLabel, setAddLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [botsData, flowsData] = await Promise.all([
        api.telegramBotsList(),
        api.telegramFlowsList(),
      ])
      setBots(Array.isArray(botsData) ? botsData : [])
      const fl = Array.isArray(flowsData) ? flowsData : (flowsData?.items || [])
      setFlows(fl)
    } catch (e) {
      console.error('TelegramMultiBotManager load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const addBot = async () => {
    if (!addToken.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      await api.telegramBotsAdd({ bot_token: addToken.trim(), label: addLabel.trim() || undefined })
      setShowAdd(false)
      setAddToken('')
      setAddLabel('')
      await load()
    } catch (e) {
      setAddError(e.message || 'Erro ao adicionar bot')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{ marginTop: 16, borderTop: `1px solid ${color}20`, paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          🤖 Bots Registrados {loading ? '...' : `(${bots.length})`}
        </div>
        <button data-tour="add-instance-btn" onClick={() => setShowAdd(s => !s)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7,
          background: showAdd ? 'rgba(34,158,217,0.12)' : 'var(--bg-base)',
          border: `1px solid ${showAdd ? color + '40' : 'var(--border-default)'}`,
          color: showAdd ? color : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
        }}>
          <Plus size={11} /> Add Bot
        </button>
      </div>

      {showAdd && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: 'rgba(34,158,217,0.05)', border: `1px solid ${color}25` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              placeholder="Bot Token (de @BotFather)..."
              value={addToken}
              onChange={e => setAddToken(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'monospace', outline: 'none' }}
            />
            <input
              type="text"
              placeholder="Nome do bot (opcional)"
              value={addLabel}
              onChange={e => setAddLabel(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, outline: 'none' }}
            />
            {addError && (
              <div style={{ fontSize: 11, color: 'var(--nexus-red)', padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                ❌ {addError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => { setShowAdd(false); setAddError(null) }}
                style={{ flex: 1, padding: '7px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}
              >
                Cancelar
              </button>
              <button
                onClick={addBot}
                disabled={!addToken.trim() || adding}
                style={{ flex: 2, padding: '7px', borderRadius: 8, background: addToken.trim() && !adding ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'var(--bg-card)', color: addToken.trim() && !adding ? 'white' : 'var(--text-muted)', border: 'none', cursor: !addToken.trim() || adding ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 700 }}
              >
                {adding ? '⏳ Conectando...' : '➕ Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bots.length === 0 ? (
        <div style={{ padding: '14px', textAlign: 'center', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? '⏳ Carregando bots...' : 'Nenhum bot registrado — clique em "Add Bot" acima.'}
        </div>
      ) : (
        <div data-tour="instance-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bots.map(bot => (
            <BotRow key={bot.id} bot={bot} flows={flows} color={color} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  )
}

function BotRow({ bot, flows, color, onRefresh }) {
  const [sel, setSel] = useState(bot.flow_id ? String(bot.flow_id) : '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const connectFlow = async (flowId) => {
    setSaving(true)
    setMsg(null)
    try {
      const d = await api.telegramBotsConnectFlow(bot.id, flowId ? parseInt(flowId) : null)
      setMsg({ ok: true, text: d?.message || 'Fluxo conectado!' })
      await onRefresh()
    } catch (e) {
      setMsg({ ok: false, text: 'Erro: ' + e.message })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Remover @${bot.username || bot.label}?`)) return
    try {
      await api.telegramBotsRemove(bot.id)
      await onRefresh()
    } catch (e) { console.error(e) }
  }

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 11,
      background: bot.flow_id ? 'rgba(34,158,217,0.05)' : 'var(--bg-base)',
      border: `1px solid ${bot.flow_id ? color + '30' : 'var(--border-subtle)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{bot.label || bot.username}</span>
            {bot.username && <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 4 }}>@{bot.username}</span>}
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: bot.flow_id ? '#10b981' : '#6b7280', flexShrink: 0 }} />
          </div>
          {bot.flow_id && (
            <div style={{ fontSize: 10, color: '#229ED9', marginTop: 2 }}>
              🔗 {bot.flow_name || `Flow #${bot.flow_id}`}
            </div>
          )}
        </div>

        <select value={sel} onChange={e => setSel(e.target.value)} style={{
          padding: '4px 8px', borderRadius: 7, background: 'var(--bg-base)',
          border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 10, outline: 'none', maxWidth: 140,
        }}>
          <option value="">— sem flow —</option>
          {flows.map(f => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
        </select>

        <button onClick={() => connectFlow(sel)} disabled={saving} title="Aplicar flow" style={{
          padding: '5px 9px', borderRadius: 7, border: 'none', cursor: saving ? 'wait' : 'pointer',
          background: `linear-gradient(135deg, ${color}, ${color}cc)`, color: 'white',
          display: 'flex', alignItems: 'center',
        }}>
          <Link2 size={11} />
        </button>

        <button onClick={remove} title="Remover bot" style={{
          padding: '5px 8px', borderRadius: 7, background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.15)', color: 'var(--nexus-red)', cursor: 'pointer',
          display: 'flex', alignItems: 'center',
        }}>
          <Trash2 size={11} />
        </button>
      </div>

    </div>
  )
}


// ── IntegrationCard ───────────────────────────────────────
function IntegrationCard({ integration }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState(integration.defaults || {})
  const [shown, setShown] = useState({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [inDb, setInDb] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [googleConnected, setGoogleConnected] = useState(null)

  const isDbProvider = DB_PROVIDERS.includes(integration.key)

  useEffect(() => {
    const saved = localStorage.getItem(`nexus_integration_${integration.key}`)
    if (saved) setValues(JSON.parse(saved))
    if (isDbProvider) {
      api.getApiKeys().then(keys => {
        if (keys && keys.find) {
          const found = keys.find(k => k.provider === integration.key)
          setInDb(!!found)
        }
      }).catch(() => {})
    }
  }, [integration.key, isDbProvider])

  useEffect(() => {
    if (integration.requiresGoogle || integration.oauthStatusUrl) {
      fetch('/google/status')
        .then(r => r.json())
        .then(d => setGoogleConnected(d.connected))
        .catch(() => setGoogleConnected(false))
    }
  }, [integration.requiresGoogle, integration.oauthStatusUrl])

  const handleSave = async () => {
    setSaving(true)
    try {
      const localValues = {}
      const secretFields = integration.fields.filter(f => f.secret).map(f => f.id)
      Object.entries(values).forEach(([k, v]) => {
        if (!secretFields.includes(k)) localValues[k] = v
      })
      if (Object.keys(localValues).length > 0) {
        localStorage.setItem(`nexus_integration_${integration.key}`, JSON.stringify(localValues))
      }
      if (isDbProvider) {
        const apiKeyField = integration.fields.find(f => f.id === 'api_key' || f.id === 'access_token' || f.id === 'bot_token')
        if (apiKeyField && values[apiKeyField.id]) {
          await api.saveApiKey(integration.key, values[apiKeyField.id], integration.name)
          setInDb(true)
        }
      } else {
        localStorage.setItem(`nexus_integration_${integration.key}`, JSON.stringify(values))
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('Save failed:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      if (integration.testMeta) {
        // ── Meta Graph API real test ──
        const token = values.api_key || values.access_token
        if (!token) {
          setTestResult({ ok: false, message: 'Insira o Access Token antes de testar' })
          setTesting(false)
          return
        }
        const res = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${token}`)
        const data = await res.json()
        if (data.error) {
          setTestResult({ ok: false, message: `Meta API: ${data.error.message}` })
        } else {
          // Try to get pages and IG accounts
          let details = `✅ Conta: ${data.name} (ID: ${data.id})`
          try {
            const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=name,instagram_business_account{id,username}&access_token=${token}`)
            const pagesData = await pagesRes.json()
            const pages = pagesData.data || []
            if (pages.length > 0) {
              details += ` · ${pages.length} página(s)`
              const igAccounts = pages.filter(p => p.instagram_business_account)
              if (igAccounts.length > 0) {
                const ig = igAccounts[0].instagram_business_account
                details += ` · IG: @${ig.username || ig.id}`
              }
            }
          } catch { /* pages fetch optional */ }
          setTestResult({ ok: true, message: details })
        }
      } else if (integration.testUrl) {
        const res = await fetch(integration.testUrl)
        const data = await res.json()
        const count = data.messages?.length ?? data.contacts?.length ?? data.events?.length ?? Object.keys(data).length
        setTestResult({ ok: true, message: `Conexão OK — ${count} item(s) retornados` })
      } else {
        await new Promise(r => setTimeout(r, 1200))
        setTestResult({ ok: true, message: `Configuração salva (ative para testar ao vivo)` })
      }
    } catch (e) {
      setTestResult({ ok: false, message: e.message })
    }
    setTesting(false)
  }

  const statusBadge = inDb
    ? { label: 'Salvo no Banco', bg: 'rgba(16,185,129,0.12)', color: 'var(--nexus-green)', dot: '#10b981' }
    : { label: 'Não configurado', bg: 'rgba(100,100,120,0.1)', color: 'var(--text-muted)', dot: '#6b7280' }

  return (
    <div style={{
      background: open ? 'var(--bg-card)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${open ? integration.color + '35' : 'var(--border-subtle)'}`,
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 10,
      transition: 'all 0.25s ease',
      boxShadow: open ? `0 0 0 1px ${integration.color}18, 0 4px 24px rgba(0,0,0,0.15)` : 'none',
    }}>
      {/* Header Row */}
      <div onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
        cursor: 'pointer', userSelect: 'none',
        background: open ? `linear-gradient(90deg, ${integration.color}08 0%, transparent 100%)` : 'transparent',
      }}>
        {/* Brand Icon */}
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: integration.color + '12',
          border: `1px solid ${integration.color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 2px 8px ${integration.color}15`,
        }}>
          {Icons[integration.icon] || <span style={{ fontSize: 20 }}>🔌</span>}
        </div>

        {/* Name + desc */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {integration.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {integration.description}
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isDbProvider && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
              background: statusBadge.bg, color: statusBadge.color,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusBadge.dot, display: 'inline-block' }} />
              {statusBadge.label}
            </span>
          )}
          {integration.requiresGoogle && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
              background: googleConnected ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
              color: googleConnected ? 'var(--nexus-green)' : 'var(--nexus-amber)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: googleConnected ? '#10b981' : '#f59e0b', display: 'inline-block' }} />
              {googleConnected ? 'OAuth OK' : 'Requer OAuth'}
            </span>
          )}

          <div style={{
            width: 24, height: 24, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            <ChevronDown size={12} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      {/* Expandable body */}
      {open && (
        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${integration.color}18` }}>
          {integration.info && (
            <div style={{
              padding: '9px 13px', marginTop: 14, borderRadius: 10, fontSize: 11,
              background: 'rgba(245,158,11,0.07)', color: 'var(--nexus-amber)',
              border: '1px solid rgba(245,158,11,0.18)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>ℹ️</span> {integration.info}
            </div>
          )}

          {/* OAuth button */}
          {integration.oauth && (
            <div style={{ marginTop: 14 }}>
              <a href={integration.oauthUrl} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 10, textDecoration: 'none',
                background: googleConnected
                  ? 'rgba(16,185,129,0.15)'
                  : 'linear-gradient(135deg, #4285f4, #357ae8)',
                color: googleConnected ? 'var(--nexus-green)' : 'white',
                fontSize: 12, fontWeight: 700,
                border: googleConnected ? '1px solid rgba(16,185,129,0.3)' : 'none',
                boxShadow: googleConnected ? 'none' : '0 2px 12px rgba(66,133,244,0.35)',
                transition: 'all 0.2s',
              }}>
                {Icons.google}
                {googleConnected ? '✅ Google Conectado — Revogar' : 'Autorizar com Google (OAuth2)'}
                <ExternalLink size={12} />
              </a>
              {!googleConnected && (
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 7 }}>
                  Clique para abrir a tela de consentimento do Google e autorizar Gmail, Contacts, Calendar e Sheets.
                </p>
              )}
            </div>
          )}

          {integration.fields.length > 0 && (
            <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {integration.fields.map(f => (
                <div key={f.id}>
                  <label style={{
                    fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)',
                    display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.6,
                  }}>
                    {f.label}
                    {f.secret && <span style={{ marginLeft: 4, opacity: 0.5, fontWeight: 400 }}>· criptografado</span>}
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type={f.secret && !shown[f.id] ? 'password' : 'text'}
                      value={values[f.id] || ''}
                      onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={{
                        flex: 1, padding: '9px 13px', borderRadius: 10,
                        background: 'var(--bg-base)', border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)', fontSize: 12,
                        fontFamily: f.secret ? 'JetBrains Mono, monospace' : 'inherit',
                        outline: 'none', transition: 'border-color 0.15s',
                      }}
                      onFocus={e => e.target.style.borderColor = integration.color}
                      onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                    />
                    {f.secret && (
                      <button
                        onClick={() => setShown(s => ({ ...s, [f.id]: !s[f.id] }))}
                        style={{
                          padding: '0 12px', borderRadius: 10,
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-muted)',
                        }}
                      >
                        {shown[f.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    )}
                  </div>
                  {f.hint && (
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: integration.color }}>💡</span> {f.hint}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {integration.note && (
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 8,
              fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic',
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
            }}>
              ℹ️ {integration.note}
            </div>
          )}



          {(integration.fields.length > 0 || integration.testUrl) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={handleTest} disabled={testing} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: 10, border: '1px solid var(--border-default)',
                background: 'var(--bg-card)', color: 'var(--text-secondary)',
                cursor: testing ? 'wait' : 'pointer', fontSize: 11, fontWeight: 600,
                transition: 'all 0.15s',
              }}>
                <TestTube size={13} /> {testing ? 'Testando...' : 'Testar Conexão'}
              </button>
              {integration.fields.length > 0 && (
                <button onClick={handleSave} disabled={saving} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                  borderRadius: 10, border: 'none',
                  background: saved
                    ? 'rgba(16,185,129,0.2)'
                    : `linear-gradient(135deg, ${integration.color}, ${integration.color}cc)`,
                  color: saved ? 'var(--nexus-green)' : 'white',
                  cursor: saving ? 'wait' : 'pointer', fontSize: 11, fontWeight: 700,
                  opacity: saving ? 0.7 : 1,
                  boxShadow: saved ? 'none' : `0 2px 10px ${integration.color}30`,
                  transition: 'all 0.2s',
                }}>
                  {saved ? <Check size={13} /> : isDbProvider ? <Database size={13} /> : <Save size={13} />}
                  {saving ? 'Salvando...' : saved ? 'Salvo!' : isDbProvider ? 'Salvar Chave' : 'Salvar'}
                </button>
              )}
            </div>
          )}

          {/* Telegram Multi-Bot Manager — only for Telegram */}
          {integration.key === 'telegram' && (
            <TelegramMultiBotManager color={integration.color} />
          )}

          {/* WhatsApp Multi-Number Manager — only for WhatsApp */}
          {integration.key === 'whatsapp' && (
            <WhatsAppMultiNumberManager color={integration.color} />
          )}

          {/* SmartMoon Engine Instance Manager */}
          {integration.key === 'smartmoon' && (
            <SmartMoonInstanceManager color={integration.color} />
          )}

          {/* Z-API Instance Manager */}
          {integration.key === 'zapi' && (
            <ZAPIInstanceManager color={integration.color} />
          )}
        </div>
      )}
    </div>
  )
}


// ── WhatsAppMultiNumberManager ────────────────────────────
function WhatsAppMultiNumberManager({ color }) {
  const [numbers, setNumbers] = useState([])
  const [flows, setFlows] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [addToken, setAddToken] = useState('')
  const [addPhoneId, setAddPhoneId] = useState('')
  const [addLabel, setAddLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [numsData, flowsData] = await Promise.all([
        api.whatsappNumbersList(),
        api.whatsappFlowsList(),
      ])
      setNumbers(Array.isArray(numsData) ? numsData : [])
      const fl = Array.isArray(flowsData) ? flowsData : (flowsData?.items || [])
      setFlows(fl)
    } catch (e) {
      console.error('WhatsAppMultiNumberManager load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const addNumber = async () => {
    if (!addToken.trim() || !addPhoneId.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      await api.whatsappNumbersAdd({
        access_token: addToken.trim(),
        phone_number_id: addPhoneId.trim(),
        label: addLabel.trim() || undefined,
      })
      setShowAdd(false)
      setAddToken('')
      setAddPhoneId('')
      setAddLabel('')
      await load()
    } catch (e) {
      setAddError(e.message || 'Erro ao adicionar número')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{ marginTop: 16, borderTop: `1px solid ${color}20`, paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          📱 Números Conectados {loading ? '...' : `(${numbers.length})`}
        </div>
        <button onClick={() => setShowAdd(s => !s)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7,
          background: showAdd ? 'rgba(37,211,102,0.12)' : 'var(--bg-base)',
          border: `1px solid ${showAdd ? color + '40' : 'var(--border-default)'}`,
          color: showAdd ? color : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
        }}>
          <Plus size={11} /> Add Número
        </button>
      </div>

      {showAdd && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: 'rgba(37,211,102,0.05)', border: `1px solid ${color}25` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              placeholder="Phone Number ID (Meta Dashboard)"
              value={addPhoneId}
              onChange={e => setAddPhoneId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'monospace', outline: 'none' }}
            />
            <input
              type="password"
              placeholder="Access Token (EAAxxxx...)"
              value={addToken}
              onChange={e => setAddToken(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'monospace', outline: 'none' }}
            />
            <input
              type="text"
              placeholder="Nome (ex: Bot Vendas)"
              value={addLabel}
              onChange={e => setAddLabel(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, outline: 'none' }}
            />
            {addError && (
              <div style={{ fontSize: 11, color: 'var(--nexus-red)', padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                ❌ {addError}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 0' }}>
              💡 Obtenha o Phone Number ID e Access Token em:{' '}
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" style={{ color: '#25D366' }}>
                Meta for Developers → WhatsApp → API Setup
              </a>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => { setShowAdd(false); setAddError(null) }}
                style={{ flex: 1, padding: '7px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}
              >
                Cancelar
              </button>
              <button
                onClick={addNumber}
                disabled={!addToken.trim() || !addPhoneId.trim() || adding}
                style={{ flex: 2, padding: '7px', borderRadius: 8, background: addToken.trim() && addPhoneId.trim() && !adding ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'var(--bg-card)', color: addToken.trim() && addPhoneId.trim() && !adding ? 'white' : 'var(--text-muted)', border: 'none', cursor: !addToken.trim() || !addPhoneId.trim() || adding ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 700 }}
              >
                {adding ? '⏳ Conectando...' : '➕ Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {numbers.length === 0 ? (
        <div style={{ padding: '14px', textAlign: 'center', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? '⏳ Carregando números...' : 'Nenhum número registrado — clique em "Add Número" acima.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {numbers.map(num => (
            <WANumberRow key={num.id} num={num} flows={flows} color={color} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  )
}

function WANumberRow({ num, flows, color, onRefresh }) {
  const [sel, setSel] = useState(num.flow_id ? String(num.flow_id) : '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const connectFlow = async (flowId) => {
    setSaving(true)
    setMsg(null)
    try {
      const d = await api.whatsappNumbersConnectFlow(num.id, flowId ? parseInt(flowId) : null)
      setMsg({ ok: true, text: d?.message || 'Fluxo conectado!' })
      await onRefresh()
    } catch (e) {
      setMsg({ ok: false, text: 'Erro: ' + e.message })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Remover ${num.label || num.display_phone}?`)) return
    try {
      await api.whatsappNumbersRemove(num.id)
      await onRefresh()
    } catch (e) { console.error(e) }
  }

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 11,
      background: num.flow_id ? 'rgba(37,211,102,0.05)' : 'var(--bg-base)',
      border: `1px solid ${num.flow_id ? color + '30' : 'var(--border-subtle)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{num.label || 'WhatsApp'}</span>
            {num.display_phone && <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 4 }}>{num.display_phone}</span>}
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: num.status === 'connected' ? '#10b981' : '#6b7280', flexShrink: 0 }} />
          </div>
          {num.flow_id && (
            <div style={{ fontSize: 10, color: '#25D366', marginTop: 2 }}>
              🔗 {num.flow_name || `Flow #${num.flow_id}`}
            </div>
          )}
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1, fontFamily: 'monospace' }}>
            ID: {num.phone_number_id}
          </div>
        </div>

        <select value={sel} onChange={e => setSel(e.target.value)} style={{
          padding: '4px 8px', borderRadius: 7, background: 'var(--bg-base)',
          border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 10, outline: 'none', maxWidth: 140,
        }}>
          <option value="">— sem flow —</option>
          {flows.map(f => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
        </select>

        <button onClick={() => connectFlow(sel)} disabled={saving} title="Aplicar flow" style={{
          padding: '5px 9px', borderRadius: 7, border: 'none', cursor: saving ? 'wait' : 'pointer',
          background: `linear-gradient(135deg, ${color}, ${color}cc)`, color: 'white',
          display: 'flex', alignItems: 'center',
        }}>
          <Link2 size={11} />
        </button>

        <button onClick={remove} title="Remover número" style={{
          padding: '5px 8px', borderRadius: 7, background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.15)', color: 'var(--nexus-red)', cursor: 'pointer',
          display: 'flex', alignItems: 'center',
        }}>
          <Trash2 size={11} />
        </button>
      </div>

    </div>
  )
}

// ── SmartMoonInstanceManager ─────────────────────────────
function SmartMoonInstanceManager({ color }) {
  const [instances, setInstances] = useState([])
  const [flows, setFlows] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [addId, setAddId] = useState('')
  const [addLabel, setAddLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [instData, flowsData] = await Promise.all([
        api.smartmoonList(),
        api.listFlows(),
      ])
      setInstances(Array.isArray(instData) ? instData : [])
      const fl = Array.isArray(flowsData) ? flowsData : (flowsData?.items || [])
      setFlows(fl)
    } catch (e) {
      console.error('SmartMoonInstanceManager load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const addInstance = async () => {
    if (!addId.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      await api.smartmoonCreate({
        instance_id: addId.trim(),
        label: addLabel.trim() || undefined,
      })
      setShowAdd(false)
      setAddId('')
      setAddLabel('')
      await load()
    } catch (e) {
      setAddError(e.message || 'Erro ao criar instância')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{ marginTop: 16, borderTop: `1px solid ${color}20`, paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          🌙 Instâncias SmartMoon {loading ? '...' : `(${instances.length})`}
        </div>
        <button data-tour="add-instance-btn" onClick={() => setShowAdd(s => !s)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7,
          background: showAdd ? `${color}12` : 'var(--bg-base)',
          border: `1px solid ${showAdd ? color + '40' : 'var(--border-default)'}`,
          color: showAdd ? color : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
        }}>
          <Plus size={11} /> Nova Instância
        </button>
      </div>

      {showAdd && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: `${color}05`, border: `1px solid ${color}25` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              placeholder="ID da instância (ex: minha-empresa)..."
              value={addId}
              onChange={e => setAddId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'monospace', outline: 'none' }}
            />
            <input
              type="text"
              placeholder="Nome/Label (opcional)"
              value={addLabel}
              onChange={e => setAddLabel(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, outline: 'none' }}
            />
            {addError && (
              <div style={{ fontSize: 11, color: 'var(--nexus-red)', padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                ❌ {addError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => { setShowAdd(false); setAddError(null) }}
                style={{ flex: 1, padding: '7px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}
              >
                Cancelar
              </button>
              <button
                onClick={addInstance}
                disabled={!addId.trim() || adding}
                style={{ flex: 2, padding: '7px', borderRadius: 8, background: addId.trim() && !adding ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'var(--bg-card)', color: addId.trim() && !adding ? 'white' : 'var(--text-muted)', border: 'none', cursor: !addId.trim() || adding ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 700 }}
              >
                {adding ? '⏳ Criando...' : '🌙 Criar Instância'}
              </button>
            </div>
          </div>
        </div>
      )}

      {instances.length === 0 ? (
        <div style={{ padding: '14px', textAlign: 'center', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? '⏳ Carregando instâncias...' : 'Nenhuma instância SmartMoon — clique em "Nova Instância" acima.'}
        </div>
      ) : (
        <div data-tour="instance-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {instances.map(inst => (
            <SmartMoonRow key={inst.id} inst={inst} flows={flows} color={color} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  )
}

function SmartMoonRow({ inst, flows, color, onRefresh }) {
  const [sel, setSel] = useState(inst.flow_id ? String(inst.flow_id) : '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [qrData, setQrData] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [statusData, setStatusData] = useState(null)
  const [checking, setChecking] = useState(false)
  const pollingRef = useRef(null)

  // ── Auto-polling: while QR is visible OR status is pending, poll every 3s ──
  useEffect(() => {
    const isQrVisible = qrData && qrData.qrCode
    const isPending = inst.status === 'pending' || inst.status === 'connecting'

    if (isQrVisible || isPending) {
      pollingRef.current = setInterval(async () => {
        try {
          const data = await api.smartmoonQrCode(inst.id)
          // If connected → dismiss QR, show success, refresh list
          if (data.status === 'CONNECTED') {
            clearInterval(pollingRef.current)
            setQrData(null)
            setMsg({ ok: true, text: `✅ Conectado como ${data.pushName || data.phoneNumber || 'WhatsApp'}` })
            await onRefresh()
          } else if (data.qrCode && data.qrCode !== qrData?.qrCode) {
            // QR rotated — update it
            setQrData(data)
          }
        } catch (_) { /* silent */ }
      }, 3000)
    }

    return () => clearInterval(pollingRef.current)
  }, [qrData?.qrCode, inst.status, inst.id])

  const connectFlow = async (flowId) => {
    setSaving(true)
    setMsg(null)
    try {
      const d = await api.smartmoonConnectFlow(inst.id, flowId ? parseInt(flowId) : null)
      setMsg({ ok: true, text: d?.message || 'Fluxo conectado!' })
      await onRefresh()
    } catch (e) {
      setMsg({ ok: false, text: 'Erro: ' + e.message })
    } finally {
      setSaving(false)
    }
  }

  const checkStatus = async () => {
    setChecking(true)
    try {
      const s = await api.smartmoonStatus(inst.id)
      setStatusData(s)
      setMsg({ ok: true, text: `Status: ${s.status || s.db_status || 'desconhecido'}` })
    } catch (e) {
      setMsg({ ok: false, text: 'Erro: ' + e.message })
    } finally {
      setChecking(false)
    }
  }

  const getQr = async () => {
    setQrLoading(true)
    try {
      const data = await api.smartmoonQrCode(inst.id)
      setQrData(data)
      if (data.status === 'CONNECTED') {
        setMsg({ ok: true, text: `✅ Já conectado como ${data.pushName || data.phoneNumber}` })
        setQrData(null)
        await onRefresh()
      }
    } catch (e) {
      setMsg({ ok: false, text: 'Erro QR: ' + e.message })
    } finally {
      setQrLoading(false)
    }
  }

  const restart = async () => {
    try {
      await api.smartmoonRestart(inst.id)
      setMsg({ ok: true, text: '♻️ Instância reiniciando...' })
      await onRefresh()
    } catch (e) {
      setMsg({ ok: false, text: 'Erro: ' + e.message })
    }
  }

  const remove = async () => {
    if (!window.confirm('Remover esta instância SmartMoon?')) return
    try {
      await api.smartmoonRemove(inst.id)
      await onRefresh()
    } catch (e) { console.error(e) }
  }

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 11,
      background: inst.flow_id ? `${color}05` : 'var(--bg-base)',
      border: `1px solid ${inst.flow_id ? color + '30' : 'var(--border-subtle)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
              🌙 {inst.label || inst.instance_id}
            </span>
            {inst.display_phone && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 4 }}>{inst.display_phone}</span>
            )}
            {inst.push_name && (
              <span style={{ fontSize: 10, color: color, background: `${color}10`, padding: '1px 5px', borderRadius: 4 }}>{inst.push_name}</span>
            )}
            <span style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: inst.status === 'connected' ? '#10b981' : inst.status === 'pending' ? '#f59e0b' : '#6b7280',
            }} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{inst.status}</span>
          </div>
          {inst.flow_id && (
            <div style={{ fontSize: 10, color, marginTop: 2 }}>
              🔗 {inst.flow_name || `Flow #${inst.flow_id}`}
            </div>
          )}
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
            {inst.conversations || 0} conversas · {inst.messages || 0} msgs
          </div>
        </div>

        <select value={sel} onChange={e => setSel(e.target.value)} style={{
          padding: '4px 8px', borderRadius: 7, background: 'var(--bg-base)',
          border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 10, outline: 'none', maxWidth: 140,
        }}>
          <option value="">— sem flow —</option>
          {flows.map(f => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
        </select>

        <button onClick={() => connectFlow(sel)} disabled={saving} title="Aplicar flow" style={{
          padding: '5px 9px', borderRadius: 7, border: 'none', cursor: saving ? 'wait' : 'pointer',
          background: `linear-gradient(135deg, ${color}, ${color}cc)`, color: 'white',
          display: 'flex', alignItems: 'center',
        }}>
          <Link2 size={11} />
        </button>

        <button onClick={remove} title="Remover instância" style={{
          padding: '5px 8px', borderRadius: 7, background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.15)', color: 'var(--nexus-red)', cursor: 'pointer',
          display: 'flex', alignItems: 'center',
        }}>
          <Trash2 size={11} />
        </button>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={checkStatus} disabled={checking} style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '3px 8px', borderRadius: 6, border: `1px solid ${color}25`,
          background: `${color}08`, color, cursor: checking ? 'wait' : 'pointer', fontSize: 9, fontWeight: 600,
        }}>
          {checking ? '...' : '📡 Status'}
        </button>
        <button onClick={getQr} disabled={qrLoading} style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '3px 8px', borderRadius: 6, border: `1px solid ${color}25`,
          background: `${color}08`, color, cursor: qrLoading ? 'wait' : 'pointer', fontSize: 9, fontWeight: 600,
        }}>
          {qrLoading ? '...' : '📱 QR Code'}
        </button>
        <button onClick={restart} style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '3px 8px', borderRadius: 6, border: `1px solid ${color}25`,
          background: `${color}08`, color, cursor: 'pointer', fontSize: 9, fontWeight: 600,
        }}>
          ♻️ Reconectar
        </button>
      </div>

      {/* QR Code display */}
      {qrData && (
        <div style={{
          marginTop: 8, padding: 10, borderRadius: 10, textAlign: 'center',
          background: `${color}05`, border: `1px solid ${color}15`,
        }}>
          {/* Engine returns: { status: 'QR_READY', qrCode: 'data:...', qrRaw: '...' } */}
          {qrData.qrCode ? (
            <>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>📱 Escaneie com WhatsApp</div>
              <img src={qrData.qrCode} alt="QR" style={{ maxWidth: 200, borderRadius: 8 }} />
              {qrData.qrRaw && (
                <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 4, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  {qrData.qrRaw.slice(0, 40)}...
                </div>
              )}
            </>
          ) : qrData.status === 'CONNECTED' ? (
            <div style={{ fontSize: 10, color: '#10b981' }}>✅ Já conectado como {qrData.pushName || qrData.phoneNumber}</div>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>⏳ {qrData.message || 'Aguardando QR...'}</div>
          )}
          <button onClick={() => setQrData(null)} style={{ marginTop: 6, padding: '3px 10px', borderRadius: 6, fontSize: 9, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Fechar
          </button>
        </div>
      )}


    </div>
  )
}

// ── ZAPIInstanceManager ──────────────────────────────────
function ZAPIInstanceManager({ color }) {
  const [instances, setInstances] = useState([])
  const [flows, setFlows] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ instance_id: '', instance_token: '', client_token: '', label: '' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [instData, flowsData] = await Promise.all([
        api.zapiList(),
        api.zapiFlowsList(),
      ])
      setInstances(Array.isArray(instData) ? instData : [])
      const fl = Array.isArray(flowsData) ? flowsData : (flowsData?.items || [])
      setFlows(fl)
    } catch (e) {
      console.error('ZAPIInstanceManager load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const addInstance = async () => {
    if (!form.instance_id.trim() || !form.instance_token.trim() || !form.client_token.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      await api.zapiAdd(form)
      setShowAdd(false)
      setForm({ instance_id: '', instance_token: '', client_token: '', label: '' })
      await load()
    } catch (e) {
      setAddError(e.message || 'Erro ao conectar')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{ marginTop: 16, borderTop: `1px solid ${color}20`, paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          ⚡ Instâncias Z-API {loading ? '...' : `(${instances.length})`}
        </div>
        <button data-tour="add-instance-btn" onClick={() => setShowAdd(s => !s)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7,
          background: showAdd ? 'rgba(124,58,237,0.12)' : 'var(--bg-base)',
          border: `1px solid ${showAdd ? color + '40' : 'var(--border-default)'}`,
          color: showAdd ? color : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
        }}>
          <Plus size={11} /> Add Instância
        </button>
      </div>

      {showAdd && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: 'rgba(124,58,237,0.05)', border: `1px solid ${color}25` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              placeholder="Instance ID (do painel Z-API)"
              value={form.instance_id}
              onChange={e => setForm({...form, instance_id: e.target.value})}
              style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'monospace', outline: 'none' }}
            />
            <input
              type="password"
              placeholder="Instance Token"
              value={form.instance_token}
              onChange={e => setForm({...form, instance_token: e.target.value})}
              style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'monospace', outline: 'none' }}
            />
            <input
              type="password"
              placeholder="Client Token (segurança)"
              value={form.client_token}
              onChange={e => setForm({...form, client_token: e.target.value})}
              style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'monospace', outline: 'none' }}
            />
            <input
              type="text"
              placeholder="Rótulo (ex: WhatsApp Vendas)"
              value={form.label}
              onChange={e => setForm({...form, label: e.target.value})}
              style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, outline: 'none' }}
            />
            {addError && (
              <div style={{ fontSize: 11, color: 'var(--nexus-red)', padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                ❌ {addError}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 0' }}>
              💡 Obtenha suas credenciais em:{' '}
              <a href="https://z-api.io" target="_blank" rel="noopener noreferrer" style={{ color: '#7C3AED' }}>
                z-api.io → Painel → Instância
              </a>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => { setShowAdd(false); setAddError(null) }}
                style={{ flex: 1, padding: '7px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}
              >
                Cancelar
              </button>
              <button
                onClick={addInstance}
                disabled={!form.instance_id.trim() || !form.instance_token.trim() || !form.client_token.trim() || adding}
                style={{ flex: 2, padding: '7px', borderRadius: 8, background: form.instance_id.trim() && form.instance_token.trim() && form.client_token.trim() && !adding ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'var(--bg-card)', color: form.instance_id.trim() && form.instance_token.trim() && form.client_token.trim() && !adding ? 'white' : 'var(--text-muted)', border: 'none', cursor: !form.instance_id.trim() || !form.instance_token.trim() || !form.client_token.trim() || adding ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 700 }}
              >
                {adding ? '⏳ Conectando...' : '⚡ Conectar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {instances.length === 0 ? (
        <div style={{ padding: '14px', textAlign: 'center', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? '⏳ Carregando instâncias...' : 'Nenhuma instância Z-API registrada — clique em "Add Instância" acima.'}
        </div>
      ) : (
        <div data-tour="instance-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {instances.map(inst => (
            <ZAPIRow key={inst.id} inst={inst} flows={flows} color={color} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  )
}

function ZAPIRow({ inst, flows, color, onRefresh }) {
  const [sel, setSel] = useState(inst.flow_id ? String(inst.flow_id) : '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [qrData, setQrData] = useState(null)
  const [checking, setChecking] = useState(false)

  const connectFlow = async (flowId) => {
    setSaving(true)
    setMsg(null)
    try {
      const d = await api.zapiConnectFlow(inst.id, flowId ? parseInt(flowId) : null)
      setMsg({ ok: true, text: d?.message || 'Fluxo conectado!' })
      await onRefresh()
    } catch (e) {
      setMsg({ ok: false, text: 'Erro: ' + e.message })
    } finally {
      setSaving(false)
    }
  }

  const checkStatus = async () => {
    setChecking(true)
    try {
      const s = await api.zapiStatus(inst.id)
      setMsg({ ok: true, text: s.connected ? '✅ Conectado' : '⚠️ Desconectado — escaneie o QR Code' })
      await onRefresh()
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setChecking(false)
    }
  }

  const showQr = async () => {
    try {
      const data = await api.zapiQrCode(inst.id)
      setQrData(data)
    } catch (e) {
      setMsg({ ok: false, text: 'Erro QR: ' + e.message })
    }
  }

  const remove = async () => {
    if (!window.confirm(`Remover instância ${inst.label || inst.instance_id}?`)) return
    try {
      await api.zapiRemove(inst.id)
      await onRefresh()
    } catch (e) { console.error(e) }
  }

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 11,
      background: inst.status === 'connected' ? 'rgba(124,58,237,0.05)' : 'var(--bg-base)',
      border: `1px solid ${inst.status === 'connected' ? color + '30' : 'var(--border-subtle)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{inst.label || 'Z-API'}</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>
              {inst.instance_id?.slice(0, 12)}...
            </span>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: inst.status === 'connected' ? '#10b981' : '#6b7280', flexShrink: 0 }} />
          </div>
          {inst.flow_id && (
            <div style={{ fontSize: 10, color: '#7C3AED', marginTop: 2 }}>
              🔗 Flow #{inst.flow_id}
            </div>
          )}
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
            {inst.conversations || 0} conversas · {inst.messages || 0} mensagens
          </div>
        </div>

        <select value={sel} onChange={e => setSel(e.target.value)} style={{
          padding: '4px 8px', borderRadius: 7, background: 'var(--bg-base)',
          border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 10, outline: 'none', maxWidth: 130,
        }}>
          <option value="">— sem flow —</option>
          {flows.map(f => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
        </select>

        <button onClick={() => connectFlow(sel)} disabled={saving} title="Aplicar flow" style={{
          padding: '5px 9px', borderRadius: 7, border: 'none', cursor: saving ? 'wait' : 'pointer',
          background: `linear-gradient(135deg, ${color}, ${color}cc)`, color: 'white',
          display: 'flex', alignItems: 'center',
        }}>
          <Link2 size={11} />
        </button>

        <button onClick={checkStatus} disabled={checking} title="Verificar status" style={{
          padding: '5px 8px', borderRadius: 7, background: 'rgba(124,58,237,0.08)',
          border: '1px solid rgba(124,58,237,0.15)', color: color, cursor: checking ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center',
        }}>
          <RefreshCw size={11} />
        </button>

        <button onClick={showQr} title="QR Code" style={{
          padding: '5px 8px', borderRadius: 7, background: 'rgba(124,58,237,0.08)',
          border: '1px solid rgba(124,58,237,0.15)', color: color, cursor: 'pointer',
          display: 'flex', alignItems: 'center', fontSize: 11,
        }}>
          📱
        </button>

        <button onClick={remove} title="Remover" style={{
          padding: '5px 8px', borderRadius: 7, background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.15)', color: 'var(--nexus-red)', cursor: 'pointer',
          display: 'flex', alignItems: 'center',
        }}>
          <Trash2 size={11} />
        </button>
      </div>

      {/* QR Code display */}
      {qrData && (
        <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)', textAlign: 'center' }}>
          {qrData.value ? (
            <>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Escaneie com o WhatsApp</div>
              {qrData.value.startsWith('data:') || qrData.value.startsWith('http') ? (
                <img src={qrData.value} alt="QR Code" style={{ maxWidth: 180, borderRadius: 8 }} />
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{qrData.value}</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 11, color: '#10b981' }}>✅ Instância já conectada</div>
          )}
          <button onClick={() => setQrData(null)} style={{ marginTop: 6, padding: '3px 10px', borderRadius: 6, fontSize: 10, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Fechar
          </button>
        </div>
      )}


    </div>
  )
}

// ── Section ───────────────────────────────────────────────
function Section({ section }) {
  const [open, setOpen] = useState(true)
  const configured = section.integrations.reduce((n, _) => n, 0)

  return (
    <div data-tour={`section-${section.id}`} style={{ marginBottom: 28 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 12, cursor: 'pointer', userSelect: 'none',
          padding: '8px 2px',
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: section.color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
        }}>
          {section.emoji}
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0.3 }}>
          {section.title.toUpperCase()}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600,
          padding: '2px 7px', borderRadius: 20,
          background: section.color + '15',
          color: section.color,
        }}>
          {section.integrations.length}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)', marginLeft: 4 }} />
        <div style={{
          width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          transition: 'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          <ChevronDown size={11} color="var(--text-muted)" />
        </div>
      </div>
      {open && section.integrations.map(i =>
        i.customCard
          ? <GoogleOAuthCard key={i.key} integration={i} />
          : <IntegrationCard key={i.key} integration={i} />
      )}
    </div>
  )
}

// ── Stats bar ─────────────────────────────────────────────
function StatsBar() {
  const total = SECTIONS.reduce((a, s) => a + s.integrations.length, 0)
  const categories = SECTIONS.length
  return (
    <div style={{
      display: 'flex', gap: 12, marginBottom: 24,
      padding: '14px 18px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 14,
    }}>
      {[
        { label: 'Integrações', value: total, color: '#a78bfa' },
        { label: 'Categorias', value: categories, color: '#60a5fa' },
        { label: 'Provid. de IA', value: 4, color: '#34d399' },
        { label: 'Mensageria', value: 2, color: '#f97316' },
      ].map(stat => (
        <div key={stat.label} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>
            {stat.value}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function Integrations() {
  const [activeTab, setActiveTab] = useState('catalog')

  const TABS = [
    { id: 'catalog', label: '⚙️ Catálogo de APIs', desc: 'Configure suas integrações' },
    { id: 'connections', label: '🔗 Minhas Conexões', desc: 'Status das conexões ativas' },
  ]

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Integrações & APIs</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '5px 0 0' }}>
            Configure e monitore as conexões do Smart Moon
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 10,
          background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)',
          fontSize: 11, color: '#a78bfa', fontWeight: 600,
        }}>
          <Zap size={12} /> Conecte e automatize
        </div>
      </div>

      {/* Tab nav */}
      <div data-tour="integration-tabs" style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 14, padding: 4,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 10,
              border: 'none', cursor: 'pointer',
              background: activeTab === tab.id
                ? 'linear-gradient(135deg, var(--nexus-violet), #818cf8)'
                : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 700,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              transition: 'all 0.2s ease',
              boxShadow: activeTab === tab.id ? '0 2px 12px rgba(99,102,241,0.3)' : 'none',
            }}
          >
            <span>{tab.label}</span>
            <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.75 }}>{tab.desc}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'catalog' && (
        <>
          <StatsBar />
          <div data-tour="integration-cards" style={{ maxWidth: 720 }}>
            {SECTIONS.map(s => <Section key={s.id} section={s} />)}
          </div>
        </>
      )}

      {activeTab === 'connections' && (
        <ConnectionsPanel embedded />
      )}
    </div>
  )
}
