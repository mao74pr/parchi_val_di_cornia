import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.models import Base
from app.routers import extract, bulk, determina

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

logger.info("=== CONFIGURAZIONE AVVIO ===")
logger.info("AWS_REGION: %s", settings.aws_region)
logger.info("BEDROCK_MODEL_ID: %s", settings.bedrock_model_id)
logger.info("AWS_ACCESS_KEY_ID presente: %s", bool(settings.aws_access_key_id))
logger.info("AWS_SECRET_ACCESS_KEY presente: %s", bool(settings.aws_secret_access_key))
logger.info("DATABASE_URL: %s", settings.database_url)
logger.info("===========================")

app = FastAPI(title="SDG Parchi Val di Cornia — Estrattore Determine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extract.router, prefix="/api", tags=["Estrazione"])
app.include_router(bulk.router, prefix="/api", tags=["Bulk GCS"])
app.include_router(determina.router, prefix="/api", tags=["Determine"])


@app.get("/health")
def health():
    return {"status": "ok"}
