import uuid, os, shutil
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException, status
from app.documents import repository
from app.documents.schema import DocumentResponse, DocumentListResponse, DOCUMENT_CATEGORIES
from app.documents.model import EmployeeDocument
from app.core.config import settings

def _doc_dir(employee_id: str) -> str:
    path = os.path.join(settings.UPLOAD_DIR, employee_id)
    os.makedirs(path, exist_ok=True)
    return path

def list_documents(db: Session, employee_id: uuid.UUID) -> DocumentListResponse:
    docs = repository.get_by_employee(db, employee_id)
    return DocumentListResponse(total=len(docs), items=[DocumentResponse.model_validate(d) for d in docs])

def upload_document(
    db: Session,
    employee_id: uuid.UUID,
    category: str,
    label: str,
    file: UploadFile,
    uploaded_by: str,
) -> DocumentResponse:
    if category not in DOCUMENT_CATEGORIES:
        raise ValueError(f"Invalid category. Must be one of: {', '.join(DOCUMENT_CATEGORIES)}")

    if file.content_type not in settings.ALLOWED_MIME_TYPES:
        raise ValueError(f"File type not allowed: {file.content_type}")

    contents = file.file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise ValueError(f"File exceeds maximum size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)}MB")

    stored_name = f"{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
    dest = os.path.join(_doc_dir(str(employee_id)), stored_name)

    with open(dest, "wb") as f:
        f.write(contents)

    doc = repository.create(db, {
        "employee_id": employee_id,
        "category": category,
        "label": label,
        "filename": file.filename,
        "stored_name": stored_name,
        "mime_type": file.content_type,
        "size_bytes": len(contents),
        "uploaded_by": uploaded_by,
    })
    db.commit()
    db.refresh(doc)
    return DocumentResponse.model_validate(doc)

def delete_document(db: Session, doc_id: uuid.UUID) -> None:
    doc = repository.get_by_id(db, doc_id)
    if not doc:
        raise ValueError("Document not found")
    dest = os.path.join(settings.UPLOAD_DIR, str(doc.employee_id), doc.stored_name)
    if os.path.exists(dest):
        os.remove(dest)
    repository.delete(db, doc)
    db.commit()

def get_document_path(db: Session, doc_id: uuid.UUID) -> tuple[EmployeeDocument, str]:
    doc = repository.get_by_id(db, doc_id)
    if not doc:
        raise ValueError("Document not found")
    path = os.path.join(settings.UPLOAD_DIR, str(doc.employee_id), doc.stored_name)
    if not os.path.exists(path):
        raise ValueError("File not found on disk")
    return doc, path