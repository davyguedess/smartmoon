from typing import Optional, Dict, Any
from loguru import logger
from app.core.luna_data.tutorial_data import LUNA_TUTORIALS, LUNA_FAQ, get_tutorial
from app.services.voice_service import VoiceService

class LunaTutorialService:
    """Serviço para gerenciar a entrega de tutoriais e FAQ pela Luna."""

    def __init__(self, db=None):
        self.db = db
        self.voice_service = VoiceService(db)

    async def get_module_explanation(self, module_key: str, company_id: int) -> Dict[str, Any]:
        """
        Prepara a explicação completa de um módulo (Texto + Imagem + Áudio).
        Se o áudio não existir no cache, ele solicita a geração (uma única vez).
        """
        tutorial = get_tutorial(module_key)
        if not tutorial:
            return {"status": "error", "message": "Módulo não encontrado"}

        # Texto formatado para o WhatsApp
        formatted_text = f"📖 *Tutorial: {tutorial['title']}*\n\n"
        formatted_text += f"{tutorial['description']}\n\n"
        formatted_text += "*Passo-a-passo:*\n"
        for step in tutorial['steps']:
            formatted_text += f"• {step['text']}\n"
        
        formatted_text += "\n_Estou enviando um áudio explicativo e uma imagem do painel abaixo..._"

        # Garantir que o áudio de tutorial esteja pronto no sistema
        # Nota: Em produção, esses áudios seriam pré-enviados para o storage.
        # Aqui, usamos o VoiceService para garantir a existência.
        audio_result = await self.voice_service.generate_voice(
            text=f"{tutorial['title']}. {tutorial['description']} " + " ".join(tutorial['steps']),
            company_id=company_id,
            voice_name="af_sky", # Voz padrão da Luna para tutoriais
            speed=1.0
        )

        return {
            "status": "success",
            "text": formatted_text,
            "image_url": tutorial["image_url"],
            "audio_url": audio_result.get("audio_path"),
            "module": module_key
        }

    def get_quick_faq(self, query: str) -> Optional[Dict[str, Any]]:
        """Busca uma resposta rápida no FAQ."""
        from app.core.luna_data.tutorial_data import search_faq
        results = search_faq(query)
        if results:
            return results[0] # Retorna o melhor match
        return None
