import {
  getOvertimeEmployeeOptions,
  getIncompleteOvertimeOrderOptions,
  type OvertimeEmployeeSourceRow,
  type OvertimeOrderSourceRow,
} from '@/modules/overtime/workflow'

const baseRow: OvertimeOrderSourceRow = {
  pcode: 'LSX-001',
  customer: 'Customer A',
  workshop: 'DMC1',
  status: '',
  initialdate: '2026-05-03',
}

describe('overtime workflow helpers', () => {
  it('keeps only incomplete production orders and sorts them for selection', () => {
    const options = getIncompleteOvertimeOrderOptions([
      { ...baseRow, pcode: 'LSX-004', status: 'Đã giao', customer: 'Delivered' },
      { ...baseRow, pcode: 'LSX-003', status: 'Hoàn thành', customer: 'Completed' },
      { ...baseRow, pcode: 'LSX-002', status: 'Chưa sản xuất', customer: 'Not started' },
      { ...baseRow, pcode: 'LSX-001', status: 'Đang SX', customer: 'Running' },
      { ...baseRow, pcode: '', status: 'Chưa sản xuất', customer: 'Missing code' },
      { ...baseRow, pcode: 'LSX-000', status: '', customer: 'No status' },
    ])

    expect(options.map((option) => option.pcode)).toEqual(['LSX-001', 'LSX-000', 'LSX-002'])
  })

  it('filters incomplete production orders by selected workshop', () => {
    const options = getIncompleteOvertimeOrderOptions([
      { ...baseRow, pcode: 'LSX-001', workshop: 'DMC1' },
      { ...baseRow, pcode: 'LSX-003', workshop: 'DMC3' },
    ], 'DMC3')

    expect(options.map((option) => option.pcode)).toEqual(['LSX-003'])
  })

  it('filters incomplete production orders by selected overtime date', () => {
    const options = getIncompleteOvertimeOrderOptions([
      { ...baseRow, pcode: 'LSX-001', initialdate: '2026-05-03' },
      { ...baseRow, pcode: 'LSX-002', initialdate: '2026-05-04' },
      { ...baseRow, pcode: 'LSX-003', initialdate: null },
    ], 'DMC1', '2026-05-04')

    expect(options.map((option) => option.pcode)).toEqual(['LSX-002'])
  })

  it('builds overtime participant options from human_resource for the selected workshop', () => {
    const employees: OvertimeEmployeeSourceRow[] = [
      { id: 2, name: 'Tran Van B', factory: 'DMC3' },
      { id: 3, name: '  ', factory: 'DMC1' },
      { id: 1, name: 'Nguyen Van A', factory: 'DMC1' },
      { id: 4, name: 'Le Thi C', factory: null },
    ]

    expect(getOvertimeEmployeeOptions(employees, 'DMC1')).toEqual([
      { id: 1, name: 'Nguyen Van A' },
    ])
  })
})
