from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class DeterminaInfo(BaseModel):
    numero: Optional[str] = None
    data: Optional[str] = None
    oggetto: Optional[str] = None
    cig: Optional[str] = None
    cup: Optional[str] = None


class Fornitore(BaseModel):
    nome: Optional[str] = None


class Importo(BaseModel):
    imponibile_totale: Optional[float] = None
    pluriennale: Optional[bool] = None
    importo_annuale: Optional[float] = None
    numero_anni: Optional[int] = None


class Imputazione(BaseModel):
    centro_di_costo: Optional[str] = None
    voce_di_spesa: Optional[str] = None
    importo: Optional[float] = None


class Ruoli(BaseModel):
    amministratore_unico: Optional[str] = None
    responsabile_del_progetto: Optional[str] = None
    responsabile_area_amministrativa: Optional[str] = None
    responsabile_area_tecnica: Optional[str] = None
    responsabile_area_marketing_comunicazione: Optional[str] = None
    responsabile_museo_baratti_populonia: Optional[str] = None
    referente_affidamento: Optional[str] = None


class DeterminaSchema(BaseModel):
    fonte_file: Optional[str] = None
    determina: Optional[DeterminaInfo] = None
    fornitore: Optional[Fornitore] = None
    importo: Optional[Importo] = None
    imputazione: Optional[list[Imputazione]] = None
    ruoli: Optional[Ruoli] = None
    base_normativa: Optional[str] = None
