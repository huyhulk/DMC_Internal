import { z } from 'zod'

// ─── Constants ────────────────────────────────────────────────────────────────

export const FAILURE_TYPES = [
  'mechanical', 'hydraulic', 'electrical', 'pneumatic',
  'tooling', 'software', 'operator', 'material',
] as const

export const FAILURE_TYPE_LABELS: Record<typeof FAILURE_TYPES[number], string> = {
  mechanical: 'Cơ khí',
  hydraulic:  'Thủy lực',
  electrical: 'Điện',
  pneumatic:  'Khí nén',
  tooling:    'Khuôn / dao',
  software:   'PLC / HMI / Cảm biến',
  operator:   'Lỗi vận hành',
  material:   'Phôi / cuộn lỗi',
}

export const MAINTENANCE_TYPES = ['daily', 'weekly', 'monthly', 'quarterly', 'annually'] as const

export const MAINTENANCE_TYPE_LABELS: Record<typeof MAINTENANCE_TYPES[number], string> = {
  daily:      'Hàng ngày',
  weekly:     'Hàng tuần',
  monthly:    'Hàng tháng',
  quarterly:  'Hàng quý',
  annually:   'Hàng năm',
}

export const DRAWING_TYPES = ['tôn', 'xà-gồ', 'panel', 'kết-cấu', 'khuôn-cán', 'lắp-đặt'] as const

export const DRAWING_TYPE_LABELS: Record<typeof DRAWING_TYPES[number], string> = {
  'tôn':      'Shop drawing tôn lợp',
  'xà-gồ':   'Shop drawing xà gồ',
  'panel':    'Shop drawing panel',
  'kết-cấu': 'Bản vẽ kết cấu khung',
  'khuôn-cán': 'Khuôn / dao cán',
  'lắp-đặt': 'Bản vẽ lắp đặt công trình',
}

export const BREAKDOWN_STATUSES = ['open', 'in_progress', 'resolved'] as const
export const BREAKDOWN_STATUS_LABELS: Record<typeof BREAKDOWN_STATUSES[number], string> = {
  open:        'Mới',
  in_progress: 'Đang xử lý',
  resolved:    'Đã xong',
}

export const DRAWING_STATUSES = ['in_progress', 'reviewing', 'approved', 'revised', 'released'] as const
export const DRAWING_STATUS_LABELS: Record<typeof DRAWING_STATUSES[number], string> = {
  in_progress: 'Đang vẽ',
  reviewing:   'Đang duyệt',
  approved:    'Đã duyệt',
  revised:     'Sửa lại',
  released:    'Phát hành',
}

export const KPI_WORKSHOPS = ['DMC1', 'DMC3', 'DMC4', 'DMC5'] as const

// ─── Breakdowns ───────────────────────────────────────────────────────────────

const breakdownBaseSchema = z.object({
  workshop:        z.enum(KPI_WORKSHOPS, { required_error: 'Chọn xưởng' }),
  machine_code:    z.string().trim().min(1, 'Nhập mã máy').max(50),
  machine_name:    z.string().trim().max(100).optional().or(z.literal('')),
  breakdown_start: z.string().min(1, 'Nhập thời gian bắt đầu'),
  breakdown_end:   z.string().optional().or(z.literal('')),
  is_planned:      z.boolean().default(false),
  failure_type:    z.enum(FAILURE_TYPES).optional(),
  status:          z.enum(BREAKDOWN_STATUSES).optional(),
  root_cause:      z.string().trim().max(1000).optional().or(z.literal('')),
  repair_action:   z.string().trim().max(1000).optional().or(z.literal('')),
  parts_replaced:  z.string().trim().max(500).optional().or(z.literal('')),
  technician:      z.string().trim().max(100).optional().or(z.literal('')),
})

export const breakdownCreateSchema = breakdownBaseSchema.refine(
  (d) => {
    if (!d.breakdown_end) return true
    return new Date(d.breakdown_end) > new Date(d.breakdown_start)
  },
  { message: 'Thời gian kết thúc phải sau thời gian bắt đầu', path: ['breakdown_end'] }
)

export const breakdownUpdateSchema = breakdownBaseSchema.partial().extend({
  id: z.string().uuid(),
})

export const breakdownResolveSchema = z.object({
  breakdown_end:  z.string().min(1, 'Nhập thời gian kết thúc'),
  repair_action:  z.string().trim().max(1000).optional().or(z.literal('')),
  parts_replaced: z.string().trim().max(500).optional().or(z.literal('')),
  technician:     z.string().trim().max(100).optional().or(z.literal('')),
})

export type BreakdownCreateInput  = z.infer<typeof breakdownCreateSchema>
export type BreakdownUpdateInput  = z.infer<typeof breakdownUpdateSchema>
export type BreakdownResolveInput = z.infer<typeof breakdownResolveSchema>

// ─── Maintenance Schedule ─────────────────────────────────────────────────────

export const scheduleCreateSchema = z.object({
  workshop:         z.enum(KPI_WORKSHOPS, { required_error: 'Chọn xưởng' }),
  machine_code:     z.string().trim().min(1, 'Nhập mã máy').max(50),
  machine_name:     z.string().trim().max(100).optional().or(z.literal('')),
  maintenance_type: z.enum(MAINTENANCE_TYPES, { required_error: 'Chọn loại bảo trì' }),
  scheduled_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  checklist_items:  z.array(z.string().trim().min(1)).optional(),
  technician:       z.string().trim().max(100).optional().or(z.literal('')),
  notes:            z.string().trim().max(1000).optional().or(z.literal('')),
})

export const scheduleBulkCreateSchema = z.object({
  workshop:         z.enum(KPI_WORKSHOPS, { required_error: 'Chọn xưởng' }),
  machine_code:     z.string().trim().min(1, 'Nhập mã máy').max(50),
  machine_name:     z.string().trim().max(100).optional().or(z.literal('')),
  maintenance_type: z.enum(MAINTENANCE_TYPES, { required_error: 'Chọn loại bảo trì' }),
  start_date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu không hợp lệ'),
  end_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày kết thúc không hợp lệ'),
  frequency:        z.enum(['weekly', 'monthly', 'quarterly'], { required_error: 'Chọn chu kỳ' }),
  checklist_items:  z.array(z.string().trim().min(1)).optional(),
  technician:       z.string().trim().max(100).optional().or(z.literal('')),
  notes:            z.string().trim().max(1000).optional().or(z.literal('')),
}).refine(
  (d) => new Date(d.end_date) >= new Date(d.start_date),
  { message: 'Ngày kết thúc phải sau ngày bắt đầu', path: ['end_date'] }
)

export const scheduleCompleteSchema = z.object({
  actual_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  technician:      z.string().trim().max(100).optional().or(z.literal('')),
  notes:           z.string().trim().max(1000).optional().or(z.literal('')),
  checklist_items: z.array(
    z.object({
      item: z.string(),
      ok:   z.boolean(),
      note: z.string().optional(),
    })
  ).optional(),
})

export type ScheduleCreateInput      = z.infer<typeof scheduleCreateSchema>
export type ScheduleBulkCreateInput  = z.infer<typeof scheduleBulkCreateSchema>
export type ScheduleCompleteInput    = z.infer<typeof scheduleCompleteSchema>

// ─── Technical Drawings ───────────────────────────────────────────────────────

const codeRegex = /^[A-Z0-9\-]{5,30}$/i

export const drawingCreateSchema = z.object({
  drawing_code:  z.string().trim().regex(codeRegex, 'Mã BV phải 5-30 ký tự chữ/số/gạch'),
  drawing_name:  z.string().trim().min(1, 'Nhập tên bản vẽ').max(200),
  drawing_type:  z.enum(DRAWING_TYPES).optional(),
  customer:      z.string().trim().max(200).optional().or(z.literal('')),
  project_code:  z.string().trim().max(100).optional().or(z.literal('')),
  request_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  due_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  drafter:       z.string().trim().max(100).optional().or(z.literal('')),
  notes:         z.string().trim().max(1000).optional().or(z.literal('')),
}).refine(
  (d) => new Date(d.due_date) >= new Date(d.request_date),
  { message: 'Hạn giao phải sau ngày yêu cầu', path: ['due_date'] }
)

export const drawingCompleteSchema = z.object({
  delivered_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  has_errors:     z.boolean().default(false),
  error_count:    z.number().int().min(0).optional(),
  error_details:  z.string().trim().max(1000).optional().or(z.literal('')),
  reviewer:       z.string().trim().max(100).optional().or(z.literal('')),
  status:         z.enum(['approved', 'released', 'revised']),
})

export type DrawingCreateInput   = z.infer<typeof drawingCreateSchema>
export type DrawingCompleteInput = z.infer<typeof drawingCompleteSchema>

// ─── Site Surveys ─────────────────────────────────────────────────────────────

export const surveyCreateSchema = z.object({
  survey_code:   z.string().trim().regex(codeRegex, 'Mã KS phải 5-30 ký tự'),
  survey_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  project_code:  z.string().trim().max(100).optional().or(z.literal('')),
  customer:      z.string().trim().max(200).optional().or(z.literal('')),
  surveyor:      z.string().trim().max(100).optional().or(z.literal('')),
  total_items:   z.number({ invalid_type_error: 'Phải là số' }).int().positive('Tổng mục đo phải > 0'),
  error_items:   z.number({ invalid_type_error: 'Phải là số' }).int().min(0, 'Số mục lỗi phải ≥ 0').default(0),
  error_details: z.array(
    z.object({
      item:     z.string(),
      expected: z.string().optional(),
      actual:   z.string().optional(),
      note:     z.string().optional(),
    })
  ).optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
}).refine(
  (d) => d.error_items <= d.total_items,
  { message: 'Số mục lỗi không được vượt tổng mục đo', path: ['error_items'] }
)

export type SurveyCreateInput = z.infer<typeof surveyCreateSchema>
