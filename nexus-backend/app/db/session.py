from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# Lazy engine and sessionmaker storage
_engines = {}
_sessionmakers = {}

def get_engine():
    import asyncio
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    
    if loop not in _engines:
        _engines[loop] = create_async_engine(
            settings.DATABASE_URL,
            echo=settings.DEBUG,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
    return _engines[loop]

def get_sessionmaker():
    import asyncio
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
        
    if loop not in _sessionmakers:
        _sessionmakers[loop] = async_sessionmaker(
            get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _sessionmakers[loop]

def AsyncSessionLocal():
    """Returns a new AsyncSession instance."""
    return get_sessionmaker()()

@property
def engine():
    """Proxy for backward compatibility."""
    return get_engine()

# For direct access if needed (not recommended, use get_engine())
# but many files import it directly
class EngineProxy:
    def __getattr__(self, name):
        return getattr(get_engine(), name)
    def __repr__(self):
        return repr(get_engine())
    def __str__(self):
        return str(get_engine())

engine = EngineProxy()

Base = declarative_base()


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
