from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import json
import logging
from concurrent.futures import ThreadPoolExecutor
import asyncio
import boto3

from app.core.dependencies import get_db, get_current_user_id
from app.services.analytics_service import AnalyticsService
from app.core.config import settings

router = APIRouter()
log = logging.getLogger("app.analytics")

class ProjectData(BaseModel):
    name: str
    description: Optional[str] = None

class TaskData(BaseModel):
    title: str
    status: str
    priority: str
    complexity: Optional[str] = None
    risk: Optional[List[str]] = None
    sprint_points: Optional[int] = None

class AIInsightsRequest(BaseModel):
    project: ProjectData
    tasks: List[TaskData]

@router.get("/summary/")
@router.get("/summary")
async def analytics_summary(
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc = AnalyticsService(db)
    return await svc.get_summary(user_id=user_id, project_id=project_id)

@router.get("/velocity/")
@router.get("/velocity")
async def velocity(
    weeks: int = 7,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc = AnalyticsService(db)
    return await svc.get_velocity(user_id=user_id, weeks=weeks)

@router.post("/ai-insights")
async def ai_insights(
    payload: AIInsightsRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Generate Project Health Insights using AWS Bedrock."""
    aws_key    = settings.AWS_ACCESS_KEY_ID
    aws_secret = settings.AWS_SECRET_ACCESS_KEY
    aws_region = settings.AWS_DEFAULT_REGION or "ap-south-1"
    model_id   = settings.BEDROCK_MODEL_ID

    if not aws_key or not aws_secret:
        # Fallback if Bedrock is not configured
        return {
            "report": {
                "health_score": 80,
                "summary": "Project is running smoothly (Mock data because AWS Bedrock keys are missing).",
                "bottlenecks": ["Waiting on external dependency", "Code reviews taking too long"],
                "actionable_recommendations": [
                    "Consider splitting large tasks.",
                    "Assign more developers to critical path tasks."
                ]
            }
        }

    tasks_context = json.dumps([t.dict() for t in payload.tasks], indent=2)
    prompt = f"""
You are an expert Agile Project Manager and Engineering Leader.
Analyze the following project and its tasks to generate a project health report.

Project: {payload.project.name}
Description: {payload.project.description or 'No description provided.'}

Tasks:
{tasks_context}

Provide a JSON output matching this schema EXACTLY:
{{
  "health_score": <integer from 0 to 100 representing overall health>,
  "summary": "<1-2 sentences summarizing the project health>",
  "bottlenecks": ["<bottleneck 1>", "<bottleneck 2>"],
  "actionable_recommendations": ["<recommendation 1>", "<recommendation 2>"]
}}
Return ONLY the JSON. No markdown formatting.
"""

    def _call_bedrock() -> str:
        client = boto3.client(
            service_name="bedrock-runtime",
            region_name=aws_region,
            aws_access_key_id=aws_key,
            aws_secret_access_key=aws_secret,
        )
        resp = client.converse(
            modelId=model_id,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 2048, "temperature": 0.5},
        )
        return resp["output"]["message"]["content"][0]["text"]

    try:
        loop = asyncio.get_running_loop()
        with ThreadPoolExecutor() as pool:
            raw_response = await loop.run_in_executor(pool, _call_bedrock)
        
        # Parse JSON
        try:
            start_idx = raw_response.find("{")
            end_idx = raw_response.rfind("}") + 1
            json_str = raw_response[start_idx:end_idx]
            report = json.loads(json_str)
            return {"report": report}
        except json.JSONDecodeError:
            log.error(f"Bedrock returned malformed JSON: {raw_response}")
            raise HTTPException(status_code=500, detail="Failed to parse AI insights")

    except Exception as e:
        log.error(f"Bedrock call failed: {e}")
        return {
            "report": {
                "health_score": 50,
                "summary": "Could not connect to AWS Bedrock for real-time analysis.",
                "bottlenecks": [],
                "actionable_recommendations": ["Check AWS credentials and network connection."]
            }
        }
