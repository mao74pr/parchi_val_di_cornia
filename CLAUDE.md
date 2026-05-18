# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Sistema per estrarre dati strutturati (JSON) da determine amministrative PDF emesse da Parchi Val di Cornia S.p.A. Il JSON estratto alimenta la compilazione automatica del Modulo d'Ordine. I PDF vengono processati via Claude su AWS Bedrock (eu-west-1).

## Stack

- **Backend**: FastAPI (Python 3.12), SQLAlchemy 2.0, Alembic, boto3, pypdf, pdf2image
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS, servito da nginx
- **DB**: PostgreSQL 16 (JSONB per i dati estratti)
- **Infra**: Docker Compose (3 servizi: `db`, `backend`, `frontend`)

## Common commands

```bash
# Avvia tutto
docker compose up --build

# Rebuild singolo servizio
docker compose build --no-cache backend
docker compose up backend -d

# Log in tempo reale
docker compose logs backend -f

# API health check
curl http://localhost:8000/health

# Upload singola determina via API
curl -X POST http://localhost:8000/api/extract \
  -F "file=@determina.pdf"

# Lista determine nel DB
curl http://localhost:8000/api/determine

# Export JSON array di tutte le determine
curl "http://localhost:8000/api/determine/export"

# Export selezione per IDs
curl "http://localhost:8000/api/determine/export?ids=uuid1,uuid2"
```

Frontend: `http://localhost:3001`  
Backend diretto: `http://localhost:8000`  
API docs (Swagger): `http://localhost:8000/docs`

## Architecture

### PDF extraction pipeline

`POST /api/extract` → `pdf_reader.extract_from_pdf()` → `bedrock.extract_determina()` → salva su DB → ritorna JSON

`pdf_reader` applica una soglia di 500 caratteri: se il testo estratto da `pypdf` supera la soglia usa la modalità `text`, altrimenti converte le pagine in PNG base64 e usa la modalità `vision` (Claude fa OCR + estrazione in un unico passaggio, nessun pytesseract).

`bedrock.extract_determina()` chiama `invoke_model` con il system prompt hardcoded in `services/bedrock.py`. Il model ID deve avere il prefisso `eu.` per il cross-region inference endpoint (es. `eu.anthropic.claude-sonnet-4-5-20250929-v1:0`).

### Data model

Il DB ha una sola tabella `determine` con un campo `raw_json JSONB` che contiene l'intero `DeterminaSchema`. Non ci sono colonne per i singoli campi estratti — tutti i dati sono nel JSONB. Le colonne separate (`fonte_file`, `source`, timestamps) servono solo per la lista/filtro.

### Pydantic schema (`schemas.py`)

`DeterminaSchema` è la struttura canonica. Tutti i campi sono `Optional` e default `null`. Cambiare questo schema richiede di aggiornare anche il system prompt in `bedrock.py`.

### Routing

```
frontend nginx (:3001)
  └── /api/* → proxy → backend:8000
  └── /* → React SPA

backend (:8000)
  ├── /api/extract        POST  — upload singolo PDF
  ├── /api/bulk           POST  — batch da bucket GCS (body: {gcs_path})
  ├── /api/determine      GET   — lista paginata (?page=&size=)
  ├── /api/determine/export GET — scarica JSON array (?ids= opzionale)
  ├── /api/determine/{id} GET/PUT/DELETE
  └── /api/determine/{id}/export GET — scarica JSON singola
```

### Credenziali AWS

Le credenziali sono passate come env var (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) — non come profilo `~/.aws`. Questo è intenzionale per compatibilità con GCP Cloud Run. Il `.env` è in `.gitignore`.

### Bulk da GCS

`POST /api/bulk` con body `{"gcs_path": "gs://bucket/folder"}` scarica tutti i PDF dal bucket e li processa in sequenza. Richiede `GCS_PROJECT_ID` e Application Default Credentials configurate nel container.

## Environment variables

Vedi `.env.example`. Le variabili obbligatorie sono `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BEDROCK_MODEL_ID`, `DATABASE_URL`.

## Database migrations

Le migration Alembic vengono applicate automaticamente all'avvio del container backend (`alembic upgrade head` nel CMD del Dockerfile). Per aggiungere una migration in sviluppo:

```bash
docker compose exec backend alembic revision --autogenerate -m "descrizione"
```
