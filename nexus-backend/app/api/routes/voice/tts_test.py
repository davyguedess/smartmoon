# app/api/routes/tts_test.py

"""Test endpoint for TTS integration.

Provides a simple POST endpoint to trigger TTS synthesis for manual testing.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import os

from app.services.tts_service import tts_service

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None
    format: Optional[str] = None

@router.post("/tts/test", tags=["tts"])
async def tts_test(request: TTSRequest):
    try:
        # Use voice as identifier. In V2, we prefer voice_profile_id if numeric.
        v_id = None
        v_profile_id = None
        
        if request.voice and isinstance(request.voice, str):
            if request.voice.isdigit():
                v_profile_id = int(request.voice)
            else:
                v_id = request.voice

        result = await tts_service.synthesize(
            request.text, 
            fmt=request.format, 
            voice=v_id, 
            voice_profile_id=v_profile_id
        )
        return {"file_path": result["file_path"], "provider": result["provider"], "format": result["format"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tts/voices", tags=["tts"])
async def get_voices():
    """List all available voices from the current TTS provider."""
    try:
        return await tts_service.get_voices()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tts/config", tags=["tts"])
async def get_tts_config():
    """Return current TTS configuration."""
    from app.core.config import settings
    return {
        "primary_provider": settings.TTS_PRIMARY_PROVIDER,
        "kokoro_url": settings.KOKORO_TTS_URL,
        "storage_path": settings.TTS_STORAGE_PATH
    }

@router.get("/tts/status", tags=["tts"])
async def get_tts_status():
    """Check which TTS providers are online/offline and which is active."""
    return await tts_service.get_status()

@router.get("/tts/audio", tags=["tts"])
async def tts_audio(path: str):
    """Serve a generated audio file by its path (relative or absolute).
    The frontend calls this after receiving the file_path from /tts/test.
    """
    # Resolve relative paths from the backend working directory
    abs_path = os.path.abspath(path)
    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    media_type = "audio/wav" if abs_path.endswith(".wav") else "audio/mpeg"
    return FileResponse(abs_path, media_type=media_type, filename=os.path.basename(abs_path))
