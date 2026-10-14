# Webhook Security Protocol

## Objetivo
Definir diretrizes para garantir a integridade, autenticidade e confiabilidade de webhooks recebidos e enviados pela plataforma.

## Requisitos
- **Assinatura HMAC SHA256**: Cada webhook deve conter header `X-Signature` calculado com segredo compartilhado.
- **Timestamp**: Header `X-Timestamp` deve estar dentro de 5 minutos da hora do servidor.
- **Deduplicação**: Identificador único `provider_event_id` armazenado em Redis Set para evitar processamento duplicado.
- **Limite de Payload**: Máximo 1 MB; rejeitar maiores.
- **Retry**: Reprocessamento automático com backoff exponencial até 3 tentativas.
- **Criptografia**: Payload sensível pode ser criptografado com chave RSA pública do receptor.
- **Rate‑limit**: Limite de 100 chamadas por minuto por tenant.

## Implementação
- Middleware `webhook_security.py` valida assinatura, timestamp e tamanho.
- Serviço `webhook_service.py` registra `provider_event_id` em Redis e coloca payload na fila `webhooks`.
- Configurações em `settings.py` (`WEBHOOK_SECRET`, `WEBHOOK_ALLOWLIST_IPS`, `WEBHOOK_RATE_LIMIT`).
- Decorador `@verify_webhook` aplicado aos endpoints de entrada.

## Auditoria
- Log de recebimento e validação de webhook em `/audit/webhooks/` com `correlation_id`, `tenant_id`, `event_id`, `status`.
- Retenção de logs de webhook por 180 dias.
