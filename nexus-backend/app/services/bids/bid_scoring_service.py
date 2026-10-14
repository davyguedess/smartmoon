"""
Serviço de scoring de aderência — calcula score 0-100 baseado no perfil de nicho.
"""
from typing import Optional
from loguru import logger


ADHERENCE_THRESHOLDS = {
    "excelente": 75,
    "alta": 50,
    "media": 25,
    "baixa": 0,
}


def calculate_score(bid: dict, niche: Optional[dict] = None) -> dict:
    """
    Calcula score de aderência (0-100) de uma licitação ao perfil de nicho.
    Retorna: {score, level, factors_positive, factors_negative, justification}
    """
    score = 0
    factors_positive = []
    factors_negative = []

    object_text = (
        (bid.get("object_text") or "") + " " + (bid.get("title") or "")
    ).lower()

    if not niche:
        # Score neutro sem nicho configurado
        return {
            "score": 50.0,
            "level": "Média",
            "factors_positive": ["Nenhum nicho configurado — score padrão"],
            "factors_negative": [],
            "justification": "Configure um perfil de nicho para obter score personalizado.",
        }

    positive_kw = [kw.lower() for kw in (niche.get("positive_keywords_json") or [])]
    negative_kw = [kw.lower() for kw in (niche.get("negative_keywords_json") or [])]

    # Keywords positivas (até 50 pts)
    matched_pos = [kw for kw in positive_kw if kw in object_text]
    kw_score = min(len(matched_pos) * 15, 50)
    score += kw_score
    if matched_pos:
        factors_positive.append(f"Palavras-chave do nicho encontradas: {', '.join(matched_pos[:5])}")

    # Keywords negativas (penalidade)
    matched_neg = [kw for kw in negative_kw if kw in object_text]
    penalty = len(matched_neg) * 20
    score -= penalty
    if matched_neg:
        factors_negative.append(f"Palavras negativas detectadas: {', '.join(matched_neg[:3])}")

    # Faixa de valor (até 20 pts)
    val = bid.get("estimated_value")
    vmin = niche.get("ideal_value_min")
    vmax = niche.get("ideal_value_max")
    if val and vmin and vmax:
        if vmin <= val <= vmax:
            score += 20
            factors_positive.append(f"Valor R$ {val:,.0f} dentro da faixa ideal")
        elif val < vmin:
            score += 5
            factors_negative.append("Valor abaixo da faixa ideal")
        else:
            score += 5
            factors_negative.append("Valor acima da faixa ideal")

    # Estado preferido (até 15 pts)
    preferred_regions = [r.upper() for r in (niche.get("preferred_regions_json") or [])]
    if preferred_regions and bid.get("state", "").upper() in preferred_regions:
        score += 15
        factors_positive.append(f"Estado {bid.get('state')} está nas regiões preferidas")

    # Órgão preferido (até 15 pts)
    preferred_organs = [o.lower() for o in (niche.get("preferred_organs_json") or [])]
    organ = (bid.get("organ_name") or "").lower()
    if preferred_organs and any(po in organ for po in preferred_organs):
        score += 15
        factors_positive.append(f"Órgão '{bid.get('organ_name')}' está na lista de preferidos")

    # Garante range 0-100
    score = max(0.0, min(100.0, float(score)))

    # Define nível
    if score >= ADHERENCE_THRESHOLDS["excelente"]:
        level = "Excelente"
    elif score >= ADHERENCE_THRESHOLDS["alta"]:
        level = "Alta"
    elif score >= ADHERENCE_THRESHOLDS["media"]:
        level = "Média"
    else:
        level = "Baixa"

    # Justificativa
    if not factors_positive and not factors_negative:
        justification = "Poucos dados disponíveis para comparação com o nicho."
    else:
        pos_str = "; ".join(factors_positive) if factors_positive else "nenhum fator positivo identificado"
        neg_str = "; ".join(factors_negative) if factors_negative else "sem fatores negativos"
        justification = f"Positivos: {pos_str}. Negativos: {neg_str}."

    return {
        "score": round(score, 1),
        "level": level,
        "factors_positive": factors_positive,
        "factors_negative": factors_negative,
        "justification": justification,
    }
