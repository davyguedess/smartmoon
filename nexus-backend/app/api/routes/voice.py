from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.services.voice_service import VoiceService
from app.models.voice import VoiceProfile
from pydantic import BaseModel

router = APIRouter(prefix="/voice", tags=["Voice"])

class TTSRequest(BaseModel):
    text: str
    voice_name: Optional[str] = "af_sky"
    speed: Optional[float] = 1.0
    voice_profile_id: Optional[int] = None

@router.get("/available")
async def list_available_voices():
    """List all native voices available in the TTS engine."""
    service = VoiceService()
    voices = await service.get_available_voices()
    return {"voices": voices}

@router.post("/test")
async def test_tts(
    body: TTSRequest,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Test voice generation for the current company."""
    service = VoiceService(db)
    result = await service.generate_voice(
        text=body.text,
        company_id=current_user.company_id,
        voice_name=body.voice_name,
        speed=body.speed,
        voice_profile_id=body.voice_profile_id
    )
    
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    
    return result

@router.get("/profiles")
async def get_voice_profiles(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all voice profiles for the current company."""
    result = await db.execute(
        select(VoiceProfile).where(VoiceProfile.company_id == current_user.company_id)
    )
    profiles = result.scalars().all()
    return profiles
