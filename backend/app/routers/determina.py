import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Determina

router = APIRouter()


@router.get("/determine")
def list_determine(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * size
    total = db.query(Determina).count()
    records = (
        db.query(Determina)
        .order_by(Determina.created_at.desc())
        .offset(offset)
        .limit(size)
        .all()
    )

    items = []
    for r in records:
        d = r.raw_json.get("determina", {}) or {}
        f = r.raw_json.get("fornitore", {}) or {}
        imp = r.raw_json.get("importo", {}) or {}
        items.append({
            "id": str(r.id),
            "fonte_file": r.fonte_file,
            "numero": d.get("numero"),
            "data": d.get("data"),
            "fornitore": f.get("nome"),
            "imponibile_totale": imp.get("imponibile_totale"),
            "source": r.source,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat(),
        })

    return {"total": total, "page": page, "size": size, "items": items}


@router.get("/determine/export")
def export_all(
    ids: str = Query(None, description="UUID separati da virgola"),
    db: Session = Depends(get_db),
):
    query = db.query(Determina)
    if ids:
        id_list = [uuid.UUID(i.strip()) for i in ids.split(",")]
        query = query.filter(Determina.id.in_(id_list))
    records = query.order_by(Determina.created_at.desc()).all()
    data = [r.raw_json for r in records]
    return Response(
        content=json.dumps(data, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=determine.json"},
    )


@router.get("/determine/{id}")
def get_determina(id: uuid.UUID, db: Session = Depends(get_db)):
    record = db.get(Determina, id)
    if not record:
        raise HTTPException(status_code=404, detail="Determina non trovata")
    return {"id": str(record.id), "source": record.source,
            "created_at": record.created_at.isoformat(),
            "updated_at": record.updated_at.isoformat(),
            "data": record.raw_json}


@router.put("/determine/{id}")
def update_determina(id: uuid.UUID, body: dict, db: Session = Depends(get_db)):
    record = db.get(Determina, id)
    if not record:
        raise HTTPException(status_code=404, detail="Determina non trovata")
    record.raw_json = body
    record.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return {"id": str(record.id), "data": record.raw_json}


@router.delete("/determine/{id}", status_code=204)
def delete_determina(id: uuid.UUID, db: Session = Depends(get_db)):
    record = db.get(Determina, id)
    if not record:
        raise HTTPException(status_code=404, detail="Determina non trovata")
    db.delete(record)
    db.commit()
    return Response(status_code=204)


@router.get("/determine/{id}/export")
def export_determina(id: uuid.UUID, db: Session = Depends(get_db)):
    record = db.get(Determina, id)
    if not record:
        raise HTTPException(status_code=404, detail="Determina non trovata")
    d = record.raw_json.get("determina", {}) or {}
    numero = d.get("numero", str(id)[:8])
    data_str = (d.get("data") or "").replace("/", "-")
    filename = f"determina_{numero}_{data_str}.json".replace(" ", "_")
    return Response(
        content=json.dumps(record.raw_json, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
