from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON
from app.db.session import Base


class LunaKnowledge(Base):
    """
    Base de conhecimento da Luna — armazena perguntas, respostas,
    áudios pré-gerados e configurações de tour guiado (Ghost Cursor).
    """
    __tablename__ = "luna_knowledge"

    id          = Column(Integer, primary_key=True, index=True)
    category    = Column(String(50), nullable=False, index=True)  # dashboard, flows, agents, payments
    question    = Column(Text, nullable=False)
    answer      = Column(Text, nullable=False)
    audio_path  = Column(String(500), nullable=True)    # caminho do arquivo TTS pré-gerado
    audio_ready = Column(Boolean, default=False)         # se o áudio já foi gerado
    
    # Configuração de tour guiado (JSON)
    # Estrutura: { "steps": [ { "selector": "[data-tour='wallet-hero']", "action": "highlight|click", "wait_for_click": true } ] }
    tour_config = Column(JSON, nullable=True)
    
    is_active   = Column(Boolean, default=True)
    sort_order  = Column(Integer, default=0)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id":          self.id,
            "category":    self.category,
            "question":    self.question,
            "answer":      self.answer,
            "audio_path":  self.audio_path,
            "audio_ready": self.audio_ready,
            "tour_config": self.tour_config,
            "is_active":   self.is_active,
            "sort_order":  self.sort_order,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
        }
