import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Determina
from app.services.gcs import list_pdf_blobs
from app.services.pdf_reader import extract_from_pdf
from app.services.bedrock import extract_determina

logger = logging.getLogger(__name__)
router = APIRouter()


class BulkRequest(BaseModel):
    gcs_path: str


@router.post("/bulk")
def process_bulk(body: BulkRequest, db: Session = Depends(get_db)):
    blobs = list_pdf_blobs(body.gcs_path)
    if not blobs:
        return {"processed": 0, "results": []}

    results = []
    for filename, pdf_bytes in blobs:
        entry = {"file": filename, "status": "ok", "id": None, "data": None, "error": None}
        try:
            pdf_data = extract_from_pdf(pdf_bytes)
            extracted = extract_determina(pdf_data, filename)
            record = Determina(
                fonte_file=filename,
                raw_json=extracted.model_dump(),
                source="gcs_bulk",
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            entry["id"] = str(record.id)
            entry["data"] = extracted.model_dump()
        except Exception as e:
            logger.error("Errore bulk su %s: %s", filename, e)
            entry["status"] = "error"
            entry["error"] = str(e)
        results.append(entry)

    ok = sum(1 for r in results if r["status"] == "ok")
    return {"processed": ok, "total": len(blobs), "results": results}
