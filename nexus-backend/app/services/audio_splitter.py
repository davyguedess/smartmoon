"""
Audio Text Splitter — Smart Moon
=================================
Divide texto longo em chunks para que cada chunk caiba em ~1 minuto de áudio.

Velocidade de fala estimada: ~140 palavras/min em Português (velocidade normal TTS).
1 minuto ≈ 140 palavras ≈ ~750–900 caracteres médios em português.
Usamos 750 chars como limite seguro.
"""

import re
from typing import List

# ── Config ───────────────────────────────────────────────────────────────────
MAX_CHARS_PER_CHUNK = 750   # ≈ 1 minuto de áudio em PT-BR


def split_text_for_audio(text: str, max_chars: int = MAX_CHARS_PER_CHUNK) -> List[str]:
    """
    Divide o texto em chunks de no máximo `max_chars` caracteres,
    respeitando fronteiras de sentença (., !, ?).

    Exemplo de uso:
        chunks = split_text_for_audio("texto longo...")
        # chunks[0] → 1º áudio, chunks[1] → 2º áudio complementar...
    """
    text = text.strip()
    if len(text) <= max_chars:
        return [text]

    # Divide em sentenças
    sentences = _split_sentences(text)

    chunks = []
    current_chunk = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # Sentença sozinha maior que o limite → divide por vírgulas/conjunções
        if len(sentence) > max_chars:
            sub_parts = _split_long_sentence(sentence, max_chars)
            for part in sub_parts:
                if len(current_chunk) + len(part) + 1 <= max_chars:
                    current_chunk += (" " if current_chunk else "") + part
                else:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = part
        else:
            if len(current_chunk) + len(sentence) + 1 <= max_chars:
                current_chunk += (" " if current_chunk else "") + sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence

    if current_chunk:
        chunks.append(current_chunk.strip())

    return [c for c in chunks if c]


def _split_sentences(text: str) -> List[str]:
    """Divide por pontuação final: . ! ?"""
    # Mantém o delimitador junto com a sentença
    parts = re.split(r'(?<=[.!?])\s+', text)
    return parts


def _split_long_sentence(sentence: str, max_chars: int) -> List[str]:
    """Divide uma sentença muito longa por vírgula ou conjunções."""
    parts = re.split(r',\s*|\s+(?:e|ou|mas|porém|pois|porque|que|então|portanto)\s+', sentence)
    chunks = []
    current = ""
    for part in parts:
        if len(current) + len(part) + 2 <= max_chars:
            current += (", " if current else "") + part
        else:
            if current:
                chunks.append(current.strip())
            # Se ainda maior, corta na força
            while len(part) > max_chars:
                chunks.append(part[:max_chars].strip())
                part = part[max_chars:]
            current = part
    if current:
        chunks.append(current.strip())
    return chunks
