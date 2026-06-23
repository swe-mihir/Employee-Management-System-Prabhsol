"""add employee_documents table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-23

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'employee_documents',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id', UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('label', sa.String(255), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('stored_name', sa.String(255), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('size_bytes', sa.BigInteger, nullable=False),
        sa.Column('uploaded_by', sa.String(255), nullable=False),
        sa.Column('uploaded_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_employee_documents_employee', 'employee_documents', ['employee_id'])

def downgrade() -> None:
    op.drop_index('idx_employee_documents_employee', table_name='employee_documents')
    op.drop_table('employee_documents')