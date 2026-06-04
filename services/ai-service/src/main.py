from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel
from typing import List

from nlp.sql_generator import SQLGenerator
from vision.planogram_analyzer import PlanogramAnalyzer
from forecasting.recommender import Recommender

app = FastAPI(title="AI Service for DMS")

sql_generator = SQLGenerator()
planogram_analyzer = PlanogramAnalyzer()
recommender = Recommender()

class NLQueryRequest(BaseModel):
    query: str

class NLQueryResponse(BaseModel):
    sql: str

class RecommendationRequest(BaseModel):
    user_id: str

class RecommendationResponse(BaseModel):
    recommendations: List[str]

class ChurnScoreResponse(BaseModel):
    churn_score: float

@app.post("/api/ai/sql-generate", response_model=NLQueryResponse)
async def generate_sql(request: NLQueryRequest):
    sql = sql_generator.generate_sql(request.query)
    return {"sql": sql}

@app.post("/api/ai/planogram")
async def analyze_planogram(file: UploadFile = File(...)):
    contents = await file.read()
    score = planogram_analyzer.analyze_image(contents)
    return {"compliance_score": score}

@app.post("/api/ai/recommend", response_model=RecommendationResponse)
async def get_recommendations(request: RecommendationRequest):
    recs = recommender.get_recommendations(request.user_id)
    return {"recommendations": recs}

@app.post("/api/ai/churn", response_model=ChurnScoreResponse)
async def get_churn_score(request: RecommendationRequest):
    score = recommender.calculate_churn_score(request.user_id)
    return {"churn_score": score}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
