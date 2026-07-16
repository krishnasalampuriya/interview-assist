from pydantic import BaseModel


class ExtractedDocumentResponse(BaseModel):
    filename: str
    content_type: str | None = None
    character_count: int
    text: str

