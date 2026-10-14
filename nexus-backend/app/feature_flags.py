from pydantic import BaseSettings
from typing import Any

class FeatureFlags(BaseSettings):
    """Feature flags loaded from environment variables.
    Example: FEATURE_TTS_ENABLED=true
    """
    FEATURE_TTS_ENABLED: bool = False
    FEATURE_BETA_MEMORY: bool = False
    FEATURE_EXPERIMENTAL_ROUTING: bool = False

    class Config:
        env_prefix = ""
        case_sensitive = False

_flags = FeatureFlags()

def is_enabled(flag_name: str) -> bool:
    """Return True if the given flag is enabled, False otherwise.
    Flag name should match the attribute name defined in FeatureFlags.
    """
    return getattr(_flags, flag_name, False)
