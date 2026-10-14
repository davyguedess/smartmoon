from typing import Any, Dict, Optional
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler
from app.services.luna_tutorial_service import LunaTutorialService

class LunaHandler(BaseNodeHandler):
    """
    Handler para o nó Luna IA.
    Executa a lógica de tutoriais ou FAQ e envia a resposta via WhatsApp (SmartMoon).
    """

    async def execute(self, input_payload: Dict[str, Any]) -> Dict[str, Any]:
        node_config = self.node.get("config", {})
        mode = node_config.get("mode", "tutorial")  # 'tutorial' ou 'faq'
        module_key = node_config.get("module")      # ex: 'dashboard', 'flow_builder'
        query = node_config.get("query")            # para modo FAQ
        
        # Obter dados da execução (wa_id, conversation_id, etc)
        # O FlowExecutor injeta o input_payload no contexto
        wa_id = self.context.get("wa_id")
        conversation_id = self.context.get("conversation_id")
        
        if not wa_id:
            logger.error("LunaHandler: wa_id não encontrado no contexto")
            return {"error": "wa_id_missing"}

        service = LunaTutorialService()
        
        try:
            if mode == "tutorial" and module_key:
                logger.info(f"LunaHandler: Executando tutorial para o módulo '{module_key}'")
                success = await service.send_tutorial_to_whatsapp(
                    wa_id=wa_id,
                    module_key=module_key,
                    company_id=self.context.get("company_id")
                )
            elif mode == "faq" and query:
                logger.info(f"LunaHandler: Buscando FAQ para a query '{query}'")
                success = await service.send_faq_response(
                    wa_id=wa_id,
                    query=query,
                    company_id=self.context.get("company_id")
                )
            else:
                logger.warning("LunaHandler: Modo ou configuração inválida")
                return {"status": "invalid_config"}

            return {"status": "success" if success else "failed"}
            
        except Exception as e:
            logger.error(f"LunaHandler Error: {e}")
            return {"status": "error", "message": str(e)}
