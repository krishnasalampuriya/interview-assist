from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.document import ExtractedDocumentResponse
from app.services.document_text import DocumentTextExtractionError, extract_text_from_document


router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/extract-text", response_model=ExtractedDocumentResponse)
async def extract_document_text(file: UploadFile = File(...)) -> ExtractedDocumentResponse:
    content = await file.read()

    try:
        text = extract_text_from_document(
            filename=file.filename or "uploaded-file",
            content=content,
            content_type=file.content_type,
        )
    except DocumentTextExtractionError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return ExtractedDocumentResponse(
        filename=file.filename or "uploaded-file",
        content_type=file.content_type,
        character_count=len(text),
        text=text,
    )

