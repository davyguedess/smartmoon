"""
NEXUS.IA — External API Handler (Flow Builder)

Executa chamadas a APIs externas configuradas na plataforma.
O nó recebe a ação (slug) e parâmetros do contexto do fluxo,
busca a configuração da API no banco e executa a chamada.

Configuração do nó no FlowBuilder:
  config: {
    api_slug: "duarte_booking",
    action: "lookup",        // slug do endpoint definido em endpoints_json
    params: { "email": "{{email}}" }  // parâmetros (suporta template vars)
  }
"""
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler


class ExternalApiHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        company_id = self.context.get("company_id")
        if not company_id:
            return {"external_api_status": "error", "error": "company_id ausente no contexto"}

        # ── Extrair config do nó ──────────────────────────────────────────
        api_slug = self.config.get("api_slug") or self.context.get("api_slug")
        action = self.config.get("action") or self.context.get("api_action")
        raw_params = self.config.get("params") or {}
        raw_body = self.config.get("body") or {}

        if not api_slug:
            return {"external_api_status": "error", "error": "api_slug não configurado no nó"}
        if not action:
            return {"external_api_status": "error", "error": "action não configurada no nó"}

        # ── Resolver template variables ───────────────────────────────────
        params = self._resolve_templates(raw_params)
        body = self._resolve_templates(raw_body)

        # ── Buscar configuração da API no banco ───────────────────────────
        try:
            from sqlalchemy import select
            from app.models.external_api import ExternalApiConfig, ExternalApiBinding
            from app.services.external_api_client import ExternalApiClient
            from app.db.session import AsyncSessionLocal

            async with AsyncSessionLocal() as db:
                # Buscar API config
                result = await db.execute(
                    select(ExternalApiConfig).where(
                        ExternalApiConfig.slug == api_slug,
                        ExternalApiConfig.is_active == True,
                    )
                )
                api_config = result.scalar_one_or_none()

                if not api_config:
                    return {"external_api_status": "error", "error": f"API '{api_slug}' não encontrada ou desativada"}

                # Buscar binding para esta empresa
                binding_result = await db.execute(
                    select(ExternalApiBinding).where(
                        ExternalApiBinding.api_config_id == api_config.id,
                        ExternalApiBinding.company_id == company_id,
                        ExternalApiBinding.is_active == True,
                    )
                )
                binding = binding_result.scalar_one_or_none()

                if not binding:
                    return {
                        "external_api_status": "error",
                        "error": f"API '{api_slug}' não está vinculada à sua empresa. Configure em Admin → Integrações.",
                    }

                # Resolver API key (binding override > config default)
                api_key = binding.api_key_override or api_config.default_api_key or ""

                # Buscar endpoint definition
                endpoints = api_config.endpoints_json or {}
                endpoint_def = endpoints.get(action)

                if not endpoint_def:
                    available = ", ".join(endpoints.keys())
                    return {
                        "external_api_status": "error",
                        "error": f"Ação '{action}' não existe na API '{api_slug}'. Disponíveis: {available}",
                    }

            # ── Executar chamada ──────────────────────────────────────────
            client = ExternalApiClient(
                base_url=api_config.base_url,
                api_key=api_key,
                auth_type=api_config.auth_type or "header",
                auth_header_name=api_config.auth_header_name or "X-API-Key",
                auth_query_param=api_config.auth_query_param or "api_key",
            )

            method = endpoint_def.get("method", "GET").upper()
            path = endpoint_def.get("path", "/")

            # Merge path params from context + explicit params
            path_params = {**params}

            result = await client.call(
                method=method,
                path=path,
                params=params if method == "GET" else None,
                body=body if method in ("POST", "PUT", "PATCH") else None,
                path_params=path_params,
            )

            logger.info(
                f"🔌 ExternalAPI [{api_slug}.{action}] → "
                f"status={result.get('status_code', '?')} | empresa={company_id}"
            )

            return {
                "external_api_status": "success" if result.get("success") else "error",
                "external_api_data": result.get("data", {}),
                "external_api_error": result.get("error"),
                "api_response": result.get("data", {}),  # alias para fácil acesso no fluxo
            }

        except Exception as e:
            logger.error(f"❌ ExternalApiHandler error: {e}")
            return {"external_api_status": "error", "error": str(e)}

    def _resolve_templates(self, data: dict) -> dict:
        """Resolve {{variable}} templates usando o contexto do fluxo."""
        resolved = {}
        for key, value in data.items():
            if isinstance(value, str) and "{{" in value:
                import re
                def _replace(match):
                    var_name = match.group(1).strip()
                    return str(self.context.get(var_name, match.group(0)))
                resolved[key] = re.sub(r"\{\{(.+?)\}\}", _replace, value)
            else:
                resolved[key] = value
        return resolved
