import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as client:
        # We don't have project_id easily, let's login first or just look at the backend logs
        pass

if __name__ == "__main__":
    asyncio.run(test())
