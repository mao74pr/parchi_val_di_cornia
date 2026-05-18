import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Determina
from app.services.pdf_reader import extract_from_pdf
from app.services.bedrock import extract_determina

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/extract")
async def extract_single(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Il file deve essere un PDF")

    pdf_bytes = await file.read()
    try:
        pdf_data = extract_from_pdf(pdf_bytes)
        result = extract_determina(pdf_data, file.filename)
    except Exception as e:
        logger.error("Errore estrazione %s: %s", file.filename, e)
        raise HTTPException(status_code=503, detail=f"Errore durante l'estrazione: {str(e)}")

    record = Determina(
        fonte_file=file.filename,
        raw_json=result.model_dump(),
        source="upload",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {"id": str(record.id), "data": result.model_dump()}
