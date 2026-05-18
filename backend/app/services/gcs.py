import io
import logging
from urllib.parse import urlparse

from google.cloud import storage

logger = logging.getLogger(__name__)


def list_pdf_blobs(gcs_path: str) -> list[tuple[str, bytes]]:
    """
    Given a GCS path like gs://bucket/folder, returns a list of
    (filename, pdf_bytes) for every .pdf file found.
    """
    parsed = urlparse(gcs_path)
    bucket_name = parsed.netloc
    prefix = parsed.path.lstrip("/")

    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blobs = bucket.list_blobs(prefix=prefix)

    results = []
    for blob in blobs:
        if not blob.name.lower().endswith(".pdf"):
            continue
        filename = blob.name.split("/")[-1]
        buf = io.BytesIO()
        blob.download_to_file(buf)
        results.append((filename, buf.getvalue()))
        logger.info("Downloaded %s (%d bytes)", filename, len(buf.getvalue()))

    return results
