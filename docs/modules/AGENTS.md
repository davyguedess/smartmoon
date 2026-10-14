# AGENTS — Documentação do Módulo

> Módulo: `agents` | Versão: 1.0 | Abril 2026

## Visão Geral

O módulo de Agentes gerencia perfis de IA configuráveis por empresa. Cada agente tem:
- Sistema de prompt próprio
- Modelo e provider de IA (Ollama, OpenAI, Gemini, Groq)
- Regras de governança de memória
- Configuração opcional de vendas (`sales_config`)
- Skills personalizadas via `AgentCustomSkill`

## Modelos de Dados

### `AgentProfile`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | int | PK |
| `company_id` | int | FK → companies |
| `name` | str | Nome do agente |
| `slug` | str | Identificador único por empresa |
| `system_prompt` | text | Prompt de sistema |
| `model` | str | Ex: `llama3.2`, `gpt-4o` |
| `provider` | str | `ollama`, `openai`, `gemini`, `groq` |
| `agent_type` | str | `general`, `sales`, `support`, `custom` |
| `memory_rules` | JSONB | Regras de retenção de memória |
| `sales_config` | JSONB | Configuração estruturada para agentes de vendas |

### `AgentCustomSkill`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | int | PK |
| `company_id` | int | FK → companies |
| `name` | str | Nome da skill |
| `slug` | str | Slug único por empresa |
| `prompt_patch` | text | Texto adicionado ao system_prompt |
| `category` | str | Categoria da skill |

## Rotas Backend

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/agents/` | GET | Lista agentes da empresa |
| `/agents/` | POST | Cria novo agente |
| `/agents/{id}` | GET | Detalhes do agente |
| `/agents/{id}` | PATCH | Atualiza agente |
| `/agents/{id}` | DELETE | Remove agente |
| `/agents/{id}/skills` | GET | Lista skills do agente |

## Expansão Planejada

- Agent Store: marketplace de templates de agentes
- Voice Agents: agentes com TTS integrado
- Agent Analytics: métricas de performance por agente
