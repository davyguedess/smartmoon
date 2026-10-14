"""
Vector Service — Qdrant integration for NEXUS.IA.
Strict isolation by company_id and category_id.
"""
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient, models
from loguru import logger
import uuid

from app.core.config import settings
from app.services.ai_client import get_ai_client

class VectorService:
    """
    Handles vector storage and retrieval with mandatory partitioning.
    Uses Qdrant as the backend.
    """

    DEFAULT_COLLECTION = "nexus_knowledge"
    VECTOR_SIZE = 1536  # Default for text-embedding-3-small

    def __init__(self, url: str = settings.QDRANT_URL):
        self.client = QdrantClient(url=url)
        self._ensure_collection()

    def _ensure_collection(self, collection_name: str = DEFAULT_COLLECTION):
        """Creates the collection if it doesn't exist."""
        try:
            collections = self.client.get_collections().collections
            exists = any(c.name == collection_name for c in collections)
            if not exists:
                logger.info(f"Creating Qdrant collection: {collection_name}")
                self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=models.VectorParams(
                        size=self.VECTOR_SIZE,
                        distance=models.Distance.COSINE
                    )
                )
                # Create payload indexes for fast filtering
                self.client.create_payload_index(
                    collection_name=collection_name,
                    field_name="company_id",
                    field_schema=models.PayloadSchemaType.INTEGER
                )
                self.client.create_payload_index(
                    collection_name=collection_name,
                    field_name="category_id",
                    field_schema=models.PayloadSchemaType.INTEGER
                )
        except Exception as e:
            logger.error(f"Failed to ensure Qdrant collection: {e}")

    async def upsert_text(
        self,
        text: str,
        company_id: int,
        category_id: Optional[int] = None,
        metadata: Optional[Dict] = None,
        collection_name: str = DEFAULT_COLLECTION
    ) -> str:
        """
        Embeds text and stores it in Qdrant with company/category metadata.
        """
        point_id = str(uuid.uuid4())
        
        # 1. Get embedding via AIClient (placeholder for now, will implement in AIClient)
        # For now, let's assume we have an embed method or we'll add it.
        ai_client = get_ai_client()
        vector = await self._get_embedding(text, company_id)
        
        if not vector:
            raise ValueError("Failed to generate embedding")

        # 2. Prepare payload
        payload = {
            "company_id": company_id,
            "category_id": category_id,
            "content": text,
            "created_at": str(uuid.uuid1()), # for temporal sorting if needed
            **(metadata or {})
        }

        # 3. Upsert to Qdrant
        self.client.upsert(
            collection_name=collection_name,
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload
                )
            ]
        )
        logger.debug(f"Vector stored: {point_id} (company={company_id}, category={category_id})")
        return point_id

    async def search(
        self,
        query_text: str,
        company_id: int,
        category_id: Optional[int] = None,
        limit: int = 5,
        score_threshold: float = 0.7,
        collection_name: str = DEFAULT_COLLECTION
    ) -> List[Dict]:
        """
        Search for relevant vectors with STRICT company and category isolation.
        """
        # 1. Get embedding for query
        vector = await self._get_embedding(query_text, company_id)
        if not vector:
            return []

        # 2. Build strict filters
        filter_list = [
            models.FieldCondition(
                key="company_id",
                match=models.MatchValue(value=company_id)
            )
        ]
        
        if category_id is not None:
            filter_list.append(
                models.FieldCondition(
                    key="category_id",
                    match=models.MatchValue(value=category_id)
                )
            )

        # 3. Perform search
        results = self.client.search(
            collection_name=collection_name,
            query_vector=vector,
            query_filter=models.Filter(must=filter_list),
            limit=limit,
            score_threshold=score_threshold
        )

        return [
            {
                "id": r.id,
                "score": r.score,
                "content": r.payload.get("content"),
                "metadata": {k: v for k, v in r.payload.items() if k not in ["content", "company_id", "category_id"]}
            }
            for r in results
        ]

    async def _get_embedding(self, text: str, company_id: int) -> List[float]:
        """
        Helper to get embeddings using AIClient.
        """
        # We will implement this in AIClient shortly.
        # For now, we try to use OpenAI if available.
        try:
            from app.services.ai_client import get_ai_client
            client = get_ai_client()
            # This is a future method we'll add
            return await client.embed(text, company_id=company_id)
        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            return []

_vector_service_instance: Optional[VectorService] = None

def get_vector_service() -> VectorService:
    global _vector_service_instance
    if _vector_service_instance is None:
        _vector_service_instance = VectorService()
    return _vector_service_instance
