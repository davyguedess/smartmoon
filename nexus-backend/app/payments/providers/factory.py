"""
NEXUS.IA — Payment Provider Factory (TASK 4.4)

Resolve qual provider usar baseado na configuração da empresa.
Suporta múltiplos providers simultâneos.

Usage:
    from app.payments.providers.factory import get_provider

    provider = await get_provider(db, company_id)
    result = await provider.create_pix_charge(...)

Configuração:
- Default: MercadoPago (retrocompatível)
- Por empresa: campo em platform_settings ou company_payment_limits
- Futuro: suporte a Stripe, PagSeguro, etc.
"""
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.payments.providers.base_provider import PaymentProviderBase


# Provider registry — lazy imports para evitar circular dependency
_PROVIDER_MAP = {
    "mercadopago": "app.payments.providers.mercadopago_provider.MercadoPagoProvider",
    "efipay":      "app.payments.providers.efipay_provider.EfiPayProvider",
}


async def get_provider(
    db: Optional[AsyncSession] = None,
    company_id: Optional[int] = None,
    provider_name: Optional[str] = None,
) -> PaymentProviderBase:
    """
    Resolve e retorna o provider de pagamento correto.

    Prioridade:
    1. provider_name explícito (se fornecido)
    2. Configuração da empresa no banco (futuro)
    3. Default: MercadoPago

    Returns:
        PaymentProviderBase — instância pronta para uso
    """
    # 1. Se provider_name foi especificado, usar diretamente
    name = provider_name

    # 2. Se não, tentar buscar config da empresa (futuro)
    if not name and company_id and db:
        name = await _get_company_provider(db, company_id)

    # 3. Default: mercadopago
    if not name:
        name = "mercadopago"

    name = name.lower().strip()

    if name not in _PROVIDER_MAP:
        raise ValueError(f"Provider desconhecido: '{name}'. Disponíveis: {list(_PROVIDER_MAP.keys())}")

    return await _instantiate_provider(name, db)


async def _get_company_provider(db: AsyncSession, company_id: int) -> Optional[str]:
    """
    Busca o provider configurado para a empresa.
    Retorna None se não houver configuração custom (usa default).
    """
    try:
        import json
        from sqlalchemy import text

        result = await db.execute(
            text("SELECT value FROM platform_settings WHERE key = 'platform_gateway_config'")
        )
        row = result.scalar_one_or_none()
        if row:
            config = json.loads(row)
            return config.get("active_provider")
    except Exception as e:
        logger.debug(f"Provider config lookup failed (using default): {e}")
    return None


async def _instantiate_provider(name: str, db=None) -> PaymentProviderBase:
    """Instancia o provider pelo nome. Lazy import."""
    if name == "mercadopago":
        from app.payments.providers.mercadopago_provider import MercadoPagoProvider
        return await MercadoPagoProvider.get_instance(db=db)

    elif name == "efipay":
        from app.payments.providers.efipay_provider import EfiPayProvider
        return EfiPayProvider()

    else:
        raise ValueError(f"Provider não implementado: {name}")


def list_available_providers() -> list[str]:
    """Retorna lista de providers disponíveis."""
    return list(_PROVIDER_MAP.keys())
