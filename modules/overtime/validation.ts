import { z } from 'zod'

export const OVERTIME_CATEGORIES = ['PRODUCTION', 'DELIVERY', 'INTERNAL'] as const

export const OVERTIME_CATEGORY_LABELS: Record<typeof OVERTIME_CATEGORIES[number], string> = {
  PRODUCTION: 'Sản xuất',
  DELIVERY: 'Giao hàng',
  INTERNAL: 'Nội bộ',
}

export const OVERTIME_REASONS = [
  'kh_dat_tre',
  'don_hang_nhieu',
  'noi_bo_sx',
  'xe_vao_tre',
  'don_hang_sll',
  'giao_hang_sll',
  'khong_du_nhan_su',
] as const

export const OVERTIME_REASON_LABELS: Record<typeof OVERTIME_REASONS[number], string> = {
  kh_dat_tre: 'KH đặt trễ / yêu cầu gấp',
  don_hang_nhieu: 'Đơn hàng nhiều, SX không kịp',
  noi_bo_sx: 'Nội bộ sản xuất',
  xe_vao_tre: 'Xe vào trễ',
  don_hang_sll: 'Đơn hàng sản xuất SLL',
  giao_hang_sll: 'Giao hàng SLL',
  khong_du_nhan_su: 'Không đủ nhân sự',
}

const participantSchema = z.object({
  employee_id: z.string().uuid().optional().nullable(),
  employee_name: z.string().trim().min(1, 'Nhập tên nhân viên').max(120),
  hours: z.coerce.number({ invalid_type_error: 'Giờ tăng ca phải là số' }).positive('Giờ tăng ca phải > 0').max(16),
})

export const overtimeRequestCreateSchema = z.object({
  ot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày tăng ca không hợp lệ'),
  customer: z.string().trim().max(200).optional().or(z.literal('')),
  pcode: z.string().trim().max(100).optional().or(z.literal('')),
  workshop: z.enum(['DMC1', 'DMC3', 'DMC4', 'DMC5'], { required_error: 'Chọn xưởng' }),
  ot_category: z.enum(OVERTIME_CATEGORIES, { required_error: 'Chọn loại tăng ca' }),
  reasons: z.record(z.boolean()).default({}),
  required_output: z.coerce.number().nonnegative().optional().nullable(),
  planned_hours: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  participants: z.array(participantSchema).min(1, 'Thêm ít nhất 1 nhân viên tăng ca'),
}).refine(
  (data) => new Set(data.participants.map((p) => p.employee_name.trim().toLowerCase())).size === data.participants.length,
  { message: 'Danh sách nhân viên tăng ca bị trùng tên', path: ['participants'] }
)

export const overtimeReviewSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
})

export type OvertimeRequestCreateInput = z.infer<typeof overtimeRequestCreateSchema>
export type OvertimeReviewInput = z.infer<typeof overtimeReviewSchema>
