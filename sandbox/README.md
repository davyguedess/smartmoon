# sandbox/ — Quarentenário Técnico do NEXUS.IA

> ⚠️ **NENHUM ARQUIVO DESTE DIRETÓRIO PODE SER IMPORTADO PELO CÓDIGO PRINCIPAL.**

Este diretório é o ponto de entrada obrigatório para todo código gerado por IA antes de ser revisado e promovido.

## Subdiretórios

| Pasta | Uso | Expiração |
|---|---|---|
| `ai-generated/` | Código gerado por IA aguardando revisão | 7 dias |
| `experiments/` | Testes técnicos e POCs | Até conclusão do spike |
| `spike/` | Provas de conceito de arquitetura | Até decisão tomada |
| `scratch/` | Rascunhos rápidos | 1 sprint |
| `draft-migrations/` | Migrations não aprovadas | Nunca sobe sem revisão humana |
| `disposable/` | Arquivos temporários | 48 horas |

## Fluxo de Promoção

```
IA gera → sandbox/ai-generated/
             ↓ revisão técnica
             ↓ teste local
             ↓ auditoria (SKILL_AI_AUDITOR)
          app/ ou src/ ou migrations/versions/
             ↓ commit documentado
```

## Regras

1. Nunca importar de `sandbox/` no código principal
2. Nunca commitar `sandbox/draft-migrations/` sem revisão humana
3. Toda migration de produção nasce em `migrations/versions/`
4. Limpar `disposable/` a cada 48h
5. Revisar `ai-generated/` a cada 7 dias
