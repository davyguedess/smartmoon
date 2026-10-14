# VOICE — Documentação do Módulo

> Módulo: `voice` | Versão: 1.0 | Abril 2026

## Visão Geral

O módulo de Voz gerencia síntese de fala (TTS), perfis de voz, clonagem vocal e 
vínculo de voz com agentes.

## Providers Suportados

| Provider | Tipo | Status |
|----------|------|--------|
| ElevenLabs | TTS + Clonagem | ✅ Ativo |
| OpenAI TTS | TTS | ✅ Ativo |
| Google TTS | TTS | ✅ Ativo |
| Edge TTS | TTS (local) | ✅ Ativo |

## Modelos de Dados

### `VoiceProfile`
Perfil de voz configurável por empresa. Pode ser uma voz nativa do provider ou clonada.

### `VoiceSample`
Amostras de áudio usadas para clonagem de voz.

### `VoiceGeneration`
Log de cada geração de áudio: custo, duração, provider, tokens.

### `AgentVoiceBinding`
Vínculo entre agente e perfil de voz (canal de entrega).

## Fluxo TTS

```
Requisição → TTSService → Provider (ElevenLabs/OpenAI/etc) → Audio → Storage
                       ↓
                VoiceGeneration (log de custo)
```

## Rotas Backend

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/voice/profiles` | GET | Lista perfis de voz |
| `/voice/profiles` | POST | Cria perfil |
| `/voice/tts` | POST | Gera áudio TTS |
| `/voice/profiles/{id}/samples` | GET | Amostras de clonagem |
| `/voice/agents/{agent_id}/bind` | POST | Vincula voz a agente |

## Expansão Planejada

- Voice Cloning: upload de amostras + treinamento no ElevenLabs
- Voice Agents: agentes que respondem em áudio via WhatsApp
- Real-time Voice: integração com streaming de voz
