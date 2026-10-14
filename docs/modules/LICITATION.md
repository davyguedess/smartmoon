# LICITAÇÃO — Documentação do Módulo

> Módulo: `licitation` (licitação) | Versão: 1.0 | Abril 2026

## Visão Geral

Módulo especializado em análise automática de editais de licitação pública.
Utiliza IA para extrair, analisar e estruturar informações de editais.

## Funcionalidades

- Upload e parse de editais em PDF
- Extração automática de requisitos, documentos e datas
- Análise de viabilidade e risco
- Geração de resumo executivo
- Alertas de prazos

## Modelos de Dados

| Model | Tabela | Descrição |
|-------|--------|-----------|
| `LicitacaoEdital` | `licitacao_editais` | Edital importado |
| `LicitacaoAnalysis` | `licitacao_analyses` | Análise do edital por IA |
| `LicitacaoDocumentReq` | `licitacao_document_reqs` | Documentos exigidos |
| `LicitacaoTimeline` | `licitacao_timelines` | Cronograma do edital |

## Fluxo de Análise

```
PDF Upload → Parser → Texto extraído → IA Analysis → 
  → Requisitos estruturados → Score de viabilidade → Alert de prazo
```

## Rotas Backend

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/bids/` | GET | Lista editais |
| `/bids/` | POST | Upload de edital |
| `/bids/{id}` | GET | Detalhes + análise |
| `/bids/{id}/analyze` | POST | Dispara análise por IA |
| `/bids/{id}/documents` | GET | Documentos exigidos |

## Expansão Planejada

- Monitoramento automático de portais de licitação (PNCP, Comprasnet)
- Score de qualificação da empresa por edital
- Auto-geração de proposta técnica
