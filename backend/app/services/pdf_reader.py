import base64
import io

from pdf2image import convert_from_bytes
from pypdf import PdfReader

MIN_TEXT_LENGTH = 500


def extract_from_pdf(pdf_bytes: bytes) -> dict:
    """
    Returns either {"mode": "text", "content": str}
    or {"mode": "vision", "pages": [base64_str, ...]}
    depending on whether the PDF has extractable text.
    """
    text = _extract_text(pdf_bytes)
    if len(text.strip()) >= MIN_TEXT_LENGTH:
        return {"mode": "text", "content": text}
    return {"mode": "vision", "pages": _pdf_to_images(pdf_bytes)}


def _extract_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _pdf_to_images(pdf_bytes: bytes) -> list[str]:
    images = convert_from_bytes(pdf_bytes, dpi=150, fmt="png")
    result = []
    for img in images:
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        result.append(base64.b64encode(buf.getvalue()).decode("utf-8"))
    return result
