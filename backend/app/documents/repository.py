from sqlalchemy.orm import Session
from sqlalchemy import select
import uuid
from app.documents.model import EmployeeDocument

def get_by_employee(db: Session, employee_id: uuid.UUID) -> list[EmployeeDocument]:
    return db.execute(
        select(EmployeeDocument)
        .where(EmployeeDocument.employee_id == employee_id)
        .order_by(EmployeeDocument.uploaded_at.desc())
    ).scalars().all()

def get_by_id(db: Session, doc_id: uuid.UUID):
    return db.execute(
        select(EmployeeDocument).where(EmployeeDocument.id == doc_id)
    ).scalar_one_or_none()

def create(db: Session, data: dict) -> EmployeeDocument:
    doc = EmployeeDocument(**data)
    db.add(doc)
    db.flush()
    return doc

def delete(db: Session, doc: EmployeeDocument) -> None:
    db.delete(doc)
    db.flush()