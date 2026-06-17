"""update salary_structure and payroll models

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-16

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # employee_salary_structure: drop old columns, add new ones
    op.drop_column('employee_salary_structure', 'base_salary')
    op.drop_column('employee_salary_structure', 'hra')
    op.drop_column('employee_salary_structure', 'transport_allowance')
    op.drop_column('employee_salary_structure', 'other_allowances')
    op.drop_column('employee_salary_structure', 'pay_cycle')
    op.add_column('employee_salary_structure', sa.Column('basic_allowance', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.add_column('employee_salary_structure', sa.Column('hra_allowance', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.add_column('employee_salary_structure', sa.Column('conveyance_allowance', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.add_column('employee_salary_structure', sa.Column('medical_allowance', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.add_column('employee_salary_structure', sa.Column('account_name', sa.String(255), nullable=True))
    op.add_column('employee_salary_structure', sa.Column('account_number', sa.String(50), nullable=True))
    op.add_column('employee_salary_structure', sa.Column('bank_ifsc_code', sa.String(20), nullable=True))
    op.add_column('employee_salary_structure', sa.Column('bank_name', sa.String(255), nullable=True))
    op.add_column('employee_salary_structure', sa.Column('bank_branch', sa.String(255), nullable=True))

    # salary_history: drop old computed columns, add variable inputs + new computed
    op.drop_column('salary_history', 'gross_salary')
    op.drop_column('salary_history', 'total_deductions')
    op.drop_column('salary_history', 'net_salary')
    op.drop_column('salary_history', 'total_ctc')
    for col in ['ot_hours', 'advance', 'loan', 'tds', 'employee_mlwf', 'employer_mlwf', 'incentive']:
        op.add_column('salary_history', sa.Column(col, sa.Numeric(12, 2), nullable=False, server_default='0'))
    for col in ['ern_basic', 'ern_hra', 'ern_conveyance', 'ern_medical', 'ot_amount',
                'gross_salary', 'emp_pf', 'emp_esic', 'pt', 'total_deductions', 'net_salary',
                'employer_pf', 'employer_admin', 'employer_total_pf', 'emp_employer_pf',
                'employer_esic', 'emp_employer_esic', 'emp_employer_mlwf', 'total_ctc']:
        op.add_column('salary_history', sa.Column(col, sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    pass