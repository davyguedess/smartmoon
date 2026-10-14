from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import os
import uuid

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.voice import VoiceProfile, VoiceProfileSettings, VoiceSample, AgentVoiceBinding, VoiceTypeEnum
from pydantic import BaseModel

router = APIRouter(prefix="/voice/v2", tags=["voice-v2"])

# --- Schemas ---
class VoiceSettingsSchema(BaseModel):
    speed: float = 1.0
    stability: float = 0.5
    similarity: float = 0.7
    style: Optional[str] = None
    volume_gain: float = 0.0

class VoiceProfileCreate(BaseModel):
    name: str
    provider: str
    voice_type: str = "native"
    language_code: str = "pt-BR"
    base_voice_id: Optional[str] = None
    settings: Optional[VoiceSettingsSchema] = None

class VoiceProfileResponse(BaseModel):
    id: int
    name: str
    slug: str
    provider: str
    voice_type: str
    language_code: str
    is_active: bool
    is_default: bool
    
    class Config:
        from_attributes = True

# --- Endpoints ---

@router.get("/profiles", response_model=List[VoiceProfileResponse])
async def list_voice_profiles(
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    """List voice profiles for current company (multi-tenant)."""
    from sqlalchemy import and_
    result = await db.execute(
        select(VoiceProfile).where(VoiceProfile.company_id == user.company_id)
    )
    return result.scalars().all()

@router.post("/profiles", response_model=VoiceProfileResponse)
async def create_voice_profile(
    profile: VoiceProfileCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    """Create a new voice profile (native or reference for cloning)."""
    # Generate slug from name
    slug = profile.name.lower().replace(" ", "-")

    new_profile = VoiceProfile(
        company_id=user.company_id,  # Multi-tenant: sempre usa a empresa do usuário
        name=profile.name,
        slug=slug,
        provider=profile.provider,
        voice_type=VoiceTypeEnum(profile.voice_type),
        language_code=profile.language_code,
        base_voice_id=profile.base_voice_id
    )
    
    db.add(new_profile)
    await db.flush()
    
    # Create default settings
    s = profile.settings or VoiceSettingsSchema()
    new_settings = VoiceProfileSettings(
        voice_profile_id=new_profile.id,
        speed=s.speed,
        stability=s.stability,
        similarity=s.similarity,
        style=s.style,
        volume_gain=s.volume_gain
    )
    db.add(new_settings)
    await db.commit()
    await db.refresh(new_profile)
    
    return new_profile

@router.delete("/profiles/{profile_id}")
async def delete_voice_profile(profile_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Delete a voice profile."""
    result = await db.execute(select(VoiceProfile).where(VoiceProfile.id == profile_id, VoiceProfile.company_id == user._token_company_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    await db.delete(profile)
    await db.commit()
    return {"message": "Profile deleted successfully"}

@router.post("/samples/upload/{profile_id}")
async def upload_voice_sample(
    profile_id: int, 
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Upload an audio sample for a specific voice profile (cloning)."""
    # Verify profile
    result = await db.execute(select(VoiceProfile).where(VoiceProfile.id == profile_id, VoiceProfile.company_id == user._token_company_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Ensure storage path exists
    upload_dir = "storage/samples"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1]
    file_name = f"{profile_id}_{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(upload_dir, file_name)
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
        
    new_sample = VoiceSample(
        voice_profile_id=profile_id,
        file_path=file_path,
        status="ready"
    )
    db.add(new_sample)
    await db.commit()
    
    return {"message": "Sample uploaded successfully", "sample_id": new_sample.id, "path": file_path}
