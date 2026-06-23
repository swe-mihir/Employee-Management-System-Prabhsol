import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.documents.schema import DocumentListResponse, DocumentResponse, DOCUMENT_CATEGORIES
from app.documents import service as doc_service
from app.auth.deps import get_audited_session, require_role, get_current_user
from app.core.security import TokenData
from app.db.deps import get_db

router = APIRouter(prefix="/employees/{employee_id}/documents", tags=["Documents"])

@router.get("", response_model=DocumentListResponse)
def list_documents(
    employee_id: uuid.UUID,
    _=Depends(require_role("admin", "manager", "hr")),
    db: Session = Depends(get_db),
):
    return doc_service.list_documents(db, employee_id)

@router.get("/categories")
def get_categories(_=Depends(require_role("admin", "manager", "hr"))):
    return {"categories": DOCUMENT_CATEGORIES}

@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    employee_id: uuid.UUID,
    category: str = Form(...),
    label: str = Form(...),
    file: UploadFile = File(...),
    current_user: TokenData = Depends(require_role("admin", "manager", "hr")),
    db: Session = Depends(get_audited_session),
):
    try:
        return doc_service.upload_document(db, employee_id, category, label, file, current_user.email)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    employee_id: uuid.UUID,
    doc_id: uuid.UUID,
    _=Depends(require_role("admin", "manager", "hr")),
    db: Session = Depends(get_audited_session),
):
    try:
        doc_service.delete_document(db, doc_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.get("/{doc_id}/view")
def view_document(
    employee_id: uuid.UUID,
    doc_id: uuid.UUID,
    _=Depends(require_role("admin", "manager", "hr")),
    db: Session = Depends(get_db),
):
    try:
        doc, path = doc_service.get_document_path(db, doc_id)
        print("mime_type =", doc.mime_type)
        print("path =", path)
        return FileResponse(path, media_type=doc.mime_type, headers={
            "Content-Disposition": f"inline; filename=\"{doc.filename}\""
        })
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.get("/{doc_id}/download")
def download_document(
    employee_id: uuid.UUID,
    doc_id: uuid.UUID,
    _=Depends(require_role("admin", "manager", "hr")),
    db: Session = Depends(get_db),
):
    try:
        doc, path = doc_service.get_document_path(db, doc_id)
        return FileResponse(path, media_type=doc.mime_type, headers={
            "Content-Disposition": f"attachment; filename=\"{doc.filename}\""
        })
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))