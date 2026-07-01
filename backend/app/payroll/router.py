from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
import uuid
from app.core.security import TokenData
from app.payroll.schema import PayrollCreate, PayrollUpdate, PayrollResponse, PayrollListResponse
from app.payroll import service as payroll_service
from app.auth.deps import get_current_user, get_audited_session, require_role
from app.db.deps import get_db
from app.core.config import settings
import base64, smtplib, os
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from pydantic import BaseModel
import re

from fastapi.responses import PlainTextResponse

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

router = APIRouter(prefix="/payroll", tags=["Payroll"])

@router.get("/me", response_model=PayrollListResponse)
def list_my_payroll(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    sort_by: str = Query("year"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: TokenData = Depends(get_current_user),
   db: Session = Depends(get_db),
):
    if not current_user.employee_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No employee record linked to this user")
    return payroll_service.list_my_payroll(
        db, current_user.employee_id, month, year, sort_by, sort_dir, page, page_size
    )


@router.get("", response_model=PayrollListResponse)
def list_payroll(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    status: str = Query("all"),
    employee_ids: Optional[List[str]] = Query(None),
    historical: bool = Query(False),
    sort_by: str = Query("year"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _=Depends(require_role("admin", "manager")),
    db: Session = Depends(get_db),
):
    return payroll_service.list_payroll(
        db, month, year, status, employee_ids,
        historical, sort_by, sort_dir, page, page_size
    )


@router.post("", response_model=PayrollResponse, status_code=status.HTTP_201_CREATED)
def create_payroll(
    payload: PayrollCreate,
    db: Session = Depends(get_audited_session),
    _=Depends(require_role("admin", "manager")),
):
    try:
        return payroll_service.create_payroll(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{record_id}", response_model=PayrollResponse)
def update_payroll(
    record_id: uuid.UUID,
    payload: PayrollUpdate,
    db: Session = Depends(get_audited_session),
    _=Depends(require_role("admin", "manager")),
):
    try:
        return payroll_service.update_payroll(db, record_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{record_id}/calculate", response_model=PayrollResponse)
def calculate_payroll(
    record_id: uuid.UUID,
    db: Session = Depends(get_audited_session),
    _=Depends(require_role("admin", "manager")),
):
    try:
        return payroll_service.calculate_payroll(db, record_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{record_id}/mark-paid", response_model=PayrollResponse)
def mark_paid(
    record_id: uuid.UUID,
    db: Session = Depends(get_audited_session),
    _=Depends(require_role("admin", "manager")),
):
    try:
        return payroll_service.mark_paid(db, record_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
MONTH_NAMES = ["January","February","March","April","May","June",
               "July","August","September","October","November","December"]

class PayslipEmailItem(BaseModel):
    employee_name: str
    work_email: str
    month: int
    year: int
    pdf_base64: str

class SendPayslipsRequest(BaseModel):
    payslips: List[PayslipEmailItem]

class SendPayslipsResponse(BaseModel):
    sent: List[str]
    failed: List[dict]

@router.post("/send-payslips", response_model=SendPayslipsResponse)
def send_payslips(
    body: SendPayslipsRequest,
    _=Depends(require_role("admin", "manager")),
):
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_pass = settings.SMTP_PASS
    smtp_from = settings.SMTP_FROM or smtp_user

    if not smtp_host or not smtp_user or not smtp_pass:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email is not configured on the server. Set SMTP_HOST, SMTP_USER, SMTP_PASS."
        )

    sent, failed = [], []

    for item in body.payslips:
        if not _EMAIL_RE.match(item.work_email):
            failed.append({"name": item.employee_name, "reason": "Invalid email address"})
            continue
        try:
            pdf_bytes = base64.b64decode(item.pdf_base64)
            month_name = MONTH_NAMES[item.month - 1]
            filename = f"Payslip_{item.employee_name.replace(' ', '_')}_{month_name}_{item.year}.pdf"

            msg = MIMEMultipart()
            msg["From"] = smtp_from
            msg["To"] = item.work_email
            msg["Subject"] = f"Your Payslip for {month_name} {item.year}"
            msg.attach(MIMEText(
                f"Dear {item.employee_name},\n\n"
                f"Please find attached your payslip for {month_name} {item.year}.\n\n"
                f"This is an auto-generated email. Please do not reply.\n\n"
                f"Regards,\nPrabh Solutions Pvt. Ltd.",
                "plain"
            ))

            part = MIMEBase("application", "octet-stream")
            part.set_payload(pdf_bytes)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
            msg.attach(part)

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.ehlo()
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_from, item.work_email, msg.as_string())

            sent.append(item.employee_name)

        except Exception as e:
            failed.append({"name": item.employee_name, "reason": str(e)})

    return {"sent": sent, "failed": failed}

@router.get("/bank-export/preview")
def bank_export_preview(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
    _=Depends(require_role("admin", "manager")),
    db: Session = Depends(get_db),
):
    included, skipped = payroll_service.bank_export_data(db, month, year)
    return {"included": included, "skipped": skipped}


@router.get("/bank-export")
def bank_export_download(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
    _=Depends(require_role("admin", "manager")),
    db: Session = Depends(get_db),
    ):
    try:
        included, skipped = payroll_service.bank_export_data(db, month, year)
        included, _ = payroll_service.bank_export_data(db, month, year)
        text = payroll_service.bank_export_file_text(included, month, year)
        filename = f"bank_bulk_payment_{year}_{str(month).zfill(2)}.txt"
        return PlainTextResponse(
            text,
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    