"""add emp_code and required_hours to employees

Revision ID: a1b2c3d4e5f6
Revises: 9e6d5a6cd337
Create Date: 2026-06-13

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '9e6d5a6cd337'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('employees', sa.Column('emp_code', sa.String(20), nullable=True, unique=True))
    op.add_column('employees', sa.Column('required_hours', sa.Numeric(4, 2), nullable=True))
    op.create_index('idx_employees_emp_code', 'employees', ['emp_code'])


def downgrade() -> None:
    op.drop_index('idx_employees_emp_code', table_name='employees')
    op.drop_column('employees', 'required_hours')
    op.drop_column('employees', 'emp_code')