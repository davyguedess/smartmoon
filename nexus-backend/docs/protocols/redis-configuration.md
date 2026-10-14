# Redis Configuration Protocol

## Objective
Define the configuration and deployment guidelines for Redis, which will be used as the message broker and cache for the platform.

## Requirements
- **Instance**: Single Redis instance (or clustered for high‑availability) reachable at `redis://localhost:6379/0`.
- **Persistence**: Enable AOF (Append‑Only File) for durability.
- **Security**: Require password authentication (`REDIS_PASSWORD`) and restrict access to internal network only.
- **Resource Limits**: Max memory `4GB`, eviction policy `allkeys-lru`.
- **Monitoring**: Export metrics via `redis_exporter` for Prometheus.

## Configuration (`settings.py`)
```python
REDIS_URL = "redis://:{REDIS_PASSWORD}@localhost:6379/0"
REDIS_MAX_MEMORY = "4gb"
REDIS_EVICTION_POLICY = "allkeys-lru"
```

## Deployment Steps
1. Install Redis (`brew install redis` on macOS or use Docker).  
2. Create a `.env` entry `REDIS_PASSWORD` (generated securely).  
3. Start Redis with the above limits (`redis-server --maxmemory $REDIS_MAX_MEMORY --maxmemory-policy $REDIS_EVICTION_POLICY`).  
4. Verify connectivity with `redis-cli ping`.

## Auditing
- Log connection attempts and failures to `/audit/redis/`.
- Retain logs for 180 days.
