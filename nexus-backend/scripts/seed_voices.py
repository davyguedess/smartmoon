import asyncio
import os
import sys

# Adiciona o diretório raiz ao path para importar os módulos da app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import AsyncSessionLocal
from app.models.voice import VoiceProfile, VoiceProfileSettings, VoiceTypeEnum

async def seed_voices():
    db = AsyncSessionLocal()
    try:
        # Check if voices already exist
        from sqlalchemy import select
        result = await db.execute(select(VoiceProfile))
        existing = result.scalars().all()
        if existing:
            print(f"Bancos de dados já possui {len(existing)} vozes. Pulando seed.")
            return

        voices = [
            # Female US
            {"name": "Bella (US)", "slug": "af-bella", "base_voice_id": "af_bella", "lang": "en-US", "gender": "female"},
            {"name": "Nicole (US)", "slug": "af-nicole", "base_voice_id": "af_nicole", "lang": "en-US", "gender": "female"},
            {"name": "Sarah (US)", "slug": "af-sarah", "base_voice_id": "af_sarah", "lang": "en-US", "gender": "female"},
            {"name": "Sky (US)", "slug": "af-sky", "base_voice_id": "af_sky", "lang": "en-US", "gender": "female"},
            
            # Female UK
            {"name": "Emma (UK)", "slug": "bf-emma", "base_voice_id": "bf_emma", "lang": "en-GB", "gender": "female"},
            {"name": "Isabella (UK)", "slug": "bf-isabella", "base_voice_id": "bf_isabella", "lang": "en-GB", "gender": "female"},
            
            # Male US
            {"name": "Adam (US)", "slug": "am-adam", "base_voice_id": "am_adam", "lang": "en-US", "gender": "male"},
            {"name": "Michael (US)", "slug": "am-michael", "base_voice_id": "am_michael", "lang": "en-US", "gender": "male"},
            
            # Male UK
            {"name": "George (UK)", "slug": "bm-george", "base_voice_id": "bm_george", "lang": "en-GB", "gender": "male"},
            {"name": "Lewis (UK)", "slug": "bm-lewis", "base_voice_id": "bm_lewis", "lang": "en-GB", "gender": "male"},
        ]

        # Inserindo vozes no banco de dados (Company ID 2 para NEXUS.IA)
        for v in voices:
            profile = VoiceProfile(
                company_id=2,
                name=v["name"],
                slug=v["slug"],
                provider="kokoro",
                voice_type=VoiceTypeEnum.native,
                language_code=v["lang"],
                base_voice_id=v["base_voice_id"]
            )
            db.add(profile)
            await db.flush()
            
            settings = VoiceProfileSettings(
                voice_profile_id=profile.id,
                speed=1.0,
                stability=0.5,
                similarity=0.7
            )
            db.add(settings)
            
        await db.commit()
        print(f"Sucesso! {len(voices)} vozes cadastradas.")

    except Exception as e:
        await db.rollback()
        print(f"Erro no seed: {e}")
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(seed_voices())
