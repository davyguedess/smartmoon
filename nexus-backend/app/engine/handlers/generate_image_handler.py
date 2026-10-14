"""
NEXUS.IA — Generate Image Node Handler (Sprint A4)
Gera imagem via FAL.ai (Flux.1 Dev) a partir do contexto do flow.

Tipos de nó registrados:
  "generate_image", "image_gen", "fal_image", "flux"

Entrada (contexto):
  message        → usada como prompt direto (se não houver prompt no config)
  ai_response    → resposta da IA anterior (usada como prompt se message vazia)
  image_prompt   → prompt explícito no config do nó

Saída (contexto para próximos nós):
  image_url      → URL pública da imagem gerada
  image_prompt   → prompt usado
  image_format   → tamanho do canvas (square_hd | portrait_4_3 | landscape_16_9)
"""
from __future__ import annotations
import os
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler


class GenerateImageHandler(BaseNodeHandler):
    """
    Nó de geração de imagem via FAL.ai.

    Config (no nó do flow builder):
      prompt  : str  — prompt de geração (suporta {{variavel}} substituição futura)
      size    : str  — square_hd | portrait_4_3 | landscape_16_9 (default: square_hd)
      model   : str  — fal-ai/flux/dev | fal-ai/flux/schnell (default: flux/dev)
    """

    async def execute(self, input_payload: dict) -> dict:
        fal_key = os.getenv("FAL_KEY", "").strip()
        if not fal_key:
            logger.warning("GenerateImageHandler: FAL_KEY não configurada no ambiente")
            return {
                "image_url":   None,
                "image_error": "Geração de imagem não configurada (FAL_KEY ausente). "
                               "Configure em: https://fal.ai/dashboard/keys",
            }

        # ── Resolver prompt ───────────────────────────────────────────────────
        prompt = (
            self.config.get("prompt")
            or self.context.get("image_prompt")
            or self.context.get("ai_response", "")
            or input_payload.get("message", "")
            or "Arte abstrata vibrante em tons de roxo e azul"   # fallback genérico
        )
        prompt = str(prompt).strip()[:500]  # limitar tamanho

        size  = self.config.get("size",  "square_hd")          # square_hd|portrait_4_3|landscape_16_9
        model = self.config.get("model", "fal-ai/flux/dev")     # fal-ai/flux/schnell é mais rápido

        logger.info(f"🎨 GenerateImageHandler: prompt='{prompt[:60]}...' size={size} model={model}")

        try:
            import fal_client  # pip install fal-client
            os.environ["FAL_KEY"] = fal_key

            result = await fal_client.run_async(
                model,
                arguments={
                    "prompt":                  prompt,
                    "image_size":              size,
                    "num_images":              1,
                    "enable_safety_checker":   True,
                    "guidance_scale":          3.5,
                    "num_inference_steps":     28,
                },
            )

            images = result.get("images", [])
            if not images:
                raise ValueError("FAL.ai retornou lista de imagens vazia")

            image_url = images[0]["url"]
            logger.success(f"✅ Imagem gerada com sucesso: {image_url[:80]}...")

            return {
                "image_url":    image_url,
                "image_prompt": prompt,
                "image_format": size,
                "image_error":  None,
            }

        except ImportError:
            logger.error("fal-client não instalado. Execute: pip install fal-client")
            return {
                "image_url":   None,
                "image_error": "Módulo fal-client não instalado no servidor.",
            }
        except Exception as e:
            logger.error(f"GenerateImageHandler error: {e}")
            return {
                "image_url":   None,
                "image_error": str(e),
            }
