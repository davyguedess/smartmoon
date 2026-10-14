# MARKETING — Documentação do Módulo

> Módulo: `marketing` | Versão: 1.0 | Abril 2026

## Visão Geral

Módulo de automação de marketing com criação de campanhas, publicação em Instagram,
análise de audiência e geração de conteúdo via IA.

## Sub-módulos

### Campaigns (Marketing)
Criação e gestão de campanhas de marketing digital.

### Instagram Publishing
Publicação automatizada de posts via Meta Graph API.

### Audience Analysis
Análise de audiência com IA para segmentação e persona.

### Caption Generation
Geração de legendas via IA para posts e stories.

### Creative Generation
Geração de criativos (imagens, textos) com IA.

## Modelos de Dados

| Model | Tabela | Descrição |
|-------|--------|-----------|
| `CampaignPost` | `campaign_posts` | Post individual de campanha |
| `CampaignAsset` | `campaign_assets` | Assets (imagens, vídeos) da campanha |
| `CampaignApproval` | `campaign_approvals` | Fluxo de aprovação |
| `CampaignPublishLog` | `campaign_publish_logs` | Log de publicações |
| `CampaignAudienceAnalysis` | `campaign_audience_analyses` | Análise de audiência |

## Rotas Backend

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/marketing/campaigns` | GET | Lista campanhas |
| `/marketing/campaigns` | POST | Cria campanha |
| `/marketing/campaigns/{id}/posts` | GET | Posts da campanha |
| `/marketing/campaigns/{id}/publish` | POST | Publica no Instagram |
| `/marketing/instagram/analyze` | POST | Analisa audiência |
