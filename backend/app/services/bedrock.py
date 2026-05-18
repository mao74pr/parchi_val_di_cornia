import json
import time
import logging

import boto3
from botocore.exceptions import ClientError

from app.config import settings
from app.schemas import DeterminaSchema

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Sei un estrattore di dati da determine amministrative italiane emesse da Parchi Val di Cornia S.p.A.
Estrai i dati e restituisci ESCLUSIVAMENTE un oggetto JSON valido, senza testo prima o dopo, senza markdown, senza ```json.
Segui questo schema:
{
  "fonte_file": null,
  "determina": {
    "numero": null,
    "data": null,
    "oggetto": null,
    "cig": null,
    "cup": null
  },
  "fornitore": {
    "nome": null
  },
  "importo": {
    "imponibile_totale": null,
    "pluriennale": false,
    "importo_annuale": null,
    "numero_anni": null
  },
  "imputazione": [
    {
      "centro_di_costo": null,
      "voce_di_spesa": null,
      "importo": null
    }
  ],
  "ruoli": {
    "amministratore_unico": null,
    "responsabile_del_progetto": null,
    "responsabile_area_amministrativa": null,
    "responsabile_area_tecnica": null,
    "responsabile_area_marketing_comunicazione": null,
    "responsabile_museo_baratti_populonia": null,
    "referente_affidamento": null
  },
  "base_normativa": null
}
Regole:
- Se un campo non è presente nel documento usa null, mai stringa vuota
- Per imputazioni multiple crea un array con una voce per ciascun centro di costo
- Per determine pluriennali: pluriennale=true, popola importo_annuale e numero_anni; imponibile_totale = importo_annuale * numero_anni
- base_normativa: usa "art. 50 c. 1, lett. a) D.Lgs. 36/2023" per lavori, "art. 50 c. 1, lett. b) D.Lgs. 36/2023" per servizi e forniture
- referente_affidamento: null se non esplicitamente indicato come tale nel documento
- fonte_file: lascia null, verrà impostato dal sistema
- data: formato GG/MM/AAAA"""

MAX_RETRIES = 3
RETRY_BACKOFF = 2.0


def extract_determina(pdf_data: dict, filename: str) -> DeterminaSchema:
    logger.info("[BEDROCK] Inizio estrazione per file: %s", filename)
    logger.info("[BEDROCK] Modalità PDF: %s", pdf_data["mode"])
    logger.info("[BEDROCK] Region: %s", settings.aws_region)
    logger.info("[BEDROCK] Model ID: %s", settings.bedrock_model_id)
    logger.info("[BEDROCK] AWS_ACCESS_KEY_ID presente: %s", bool(settings.aws_access_key_id))
    logger.info("[BEDROCK] AWS_SECRET_ACCESS_KEY presente: %s", bool(settings.aws_secret_access_key))

    client = boto3.client(
        "bedrock-runtime",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
    )

    messages = _build_messages(pdf_data)
    logger.info("[BEDROCK] Messaggio costruito, invio a Bedrock...")

    try:
        raw_json = _invoke_with_retry(client, messages)
    except Exception as e:
        logger.error("[BEDROCK] Errore durante invoke_model: %s: %s", type(e).__name__, str(e))
        raise

    logger.info("[BEDROCK] Risposta ricevuta, parsing JSON...")
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        logger.error("[BEDROCK] JSON non parsabile. Risposta grezza: %s", raw_json[:500])
        raise

    data["fonte_file"] = filename
    logger.info("[BEDROCK] Estrazione completata con successo per: %s", filename)
    return DeterminaSchema(**data)


def _build_messages(pdf_data: dict) -> list[dict]:
    if pdf_data["mode"] == "text":
        content_len = len(pdf_data["content"])
        logger.info("[BEDROCK] Testo estratto: %d caratteri", content_len)
        return [
            {
                "role": "user",
                "content": f"Estrai i dati da questa determina amministrativa:\n\n{pdf_data['content']}",
            }
        ]

    num_pages = len(pdf_data["pages"])
    logger.info("[BEDROCK] PDF vision: %d pagine", num_pages)
    content = [
        {"type": "text", "text": "Estrai i dati da questa determina amministrativa (PDF scansionato):"}
    ]
    for page_b64 in pdf_data["pages"]:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": page_b64,
            },
        })
    return [{"role": "user", "content": content}]


def _invoke_with_retry(client, messages: list[dict]) -> str:
    for attempt in range(MAX_RETRIES):
        logger.info("[BEDROCK] Tentativo %d/%d", attempt + 1, MAX_RETRIES)
        try:
            response = client.invoke_model(
                modelId=settings.bedrock_model_id,
                body=json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 4096,
                    "system": SYSTEM_PROMPT,
                    "messages": messages,
                }),
                contentType="application/json",
                accept="application/json",
            )
            body = json.loads(response["body"].read())
            logger.info("[BEDROCK] Risposta OK, stop_reason: %s", body.get("stop_reason"))
            text = body["content"][0]["text"].strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return text
        except ClientError as e:
            code = e.response["Error"]["Code"]
            message = e.response["Error"].get("Message", "")
            logger.error("[BEDROCK] ClientError - Code: %s, Message: %s", code, message)
            if code == "ThrottlingException" and attempt < MAX_RETRIES - 1:
                wait = RETRY_BACKOFF ** (attempt + 1)
                logger.warning("[BEDROCK] Throttling, retry in %.1fs", wait)
                time.sleep(wait)
                continue
            raise
        except Exception as e:
            logger.error("[BEDROCK] Errore generico tentativo %d: %s: %s", attempt + 1, type(e).__name__, str(e))
            raise
    raise RuntimeError("Bedrock: max retries exceeded")
