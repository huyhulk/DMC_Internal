import { z } from 'zod'

// ─── Constants ────────────────────────────────────────────────────────────────

export const VEHICLE_TYPES = [
  'xe-tải-2t', 'xe-tải-3.5t', 'xe-tải-5t', 'xe-tải-8t', 'xe-tải-15t',
  'container-20', 'container-40',
  'xe-rơ-mooc-tôn-dài', 'xe-cẩu',
] as const

export const VEHICLE_TYPE_LABELS: Record<typeof VEHICLE_TYPES[number], string> = {
  'xe-tải-2t':          'Xe tải 2T',
  'xe-tải-3.5t':        'Xe tải 3.5T',
  'xe-tải-5t':          'Xe tải 5T',
  'xe-tải-8t':          'Xe tải 8T',
  'xe-tải-15t':         'Xe tải 15T',
  'container-20':       'Container 20ft',
  'container-40':       'Container 40ft',
  'xe-rơ-mooc-tôn-dài': 'Xe rơ-moóc tôn dài',
  'xe-cẩu':             'Xe cẩu',
}

export const DELIVERY_STATUSES = ['planned', 'in_transit', 'delivered', 'damaged', 'cancelled'] as const
export const DELIVERY_STATUS_LABELS: Record<typeof DELIVERY_STATUSES[number], string> = {
  planned:    'Kế hoạch',
  in_transit: 'Đang giao',
  delivered:  'Đã giao',
  damaged:    'Hư hỏng',
  cancelled:  'Hủy',
}

export const FIVE_S_CATEGORIES = ['Sàng lọc', 'Sắp xếp', 'Sạch sẽ', 'Săn sóc', 'Sẵn sàng'] as const

export const SEVERITIES = ['low', 'medium', 'high'] as const
export const SEVERITY_LABELS: Record<typeof SEVERITIES[number], string> = {
  low:    'Thấp',
  medium: 'Trung bình',
  high:   'Cao',
}

export const REPORT_TYPES = ['weekly', 'monthly', 'quarterly', 'yearly', 'adhoc'] as const
export const REPORT_TYPE_LABELS: Record<typeof REPORT_TYPES[number], string> = {
  weekly:    'Tuần',
  monthly:   'Tháng',
  quarterly: 'Quý',
  yearly:    'Năm',
  adhoc:     'Đột xuất',
}

export const ISO_CATEGORIES = ['quality', 'safety', 'HR', 'finance', 'production'] as const
export const ISO_CATEGORY_LABELS: Record<typeof ISO_CATEGORIES[number], string> = {
  quality:    'Chất lượng',
  safety:     'An toàn',
  HR:         'Nhân sự',
  finance:    'Tài chính',
  production: 'Sản xuất',
}

export const ISO_STATUSES = ['draft', 'reviewing', 'approved', 'released', 'revised'] as const
export const ISO_STATUS_LABELS: Record<typeof ISO_STATUSES[number], string> = {
  draft:     'Dự thảo',
  reviewing: 'Đang duyệt',
  approved:  'Đã duyệt',
  released:  'Phát hành',
  revised:   'Sửa lại',
}

export const KPI_WORKSHOPS = ['DMC1', 'DMC3', 'DMC4', 'DMC5'] as const

const codeRegex = /^[A-Z0-9\-]{5,30}$/i

// ─── Deliveries ───────────────────────────────────────────────────────────────

export const deliveryCreateSchema = z.object({
  delivery_code:    z.string().trim().regex(codeRegex, 'Mã GH phải 5-30 ký tự'),
  pcode:            z.string().trim().max(50).optional().or(z.literal('')),
  customer:         z.string().trim().min(1, 'Nhập tên khách hàng').max(200),
  delivery_address: z.string().trim().max(500).optional().or(z.literal('')),
  planned_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  total_weight_tons: z.number({ invalid_type_error: 'Phải là số' })
    .positive('Khối lượng phải > 0')
    .multipleOf(0.001),
  vehicle_code:     z.string().trim().max(20).optional().or(z.literal('')),
  driver:           z.string().trim().max(100).optional().or(z.literal('')),
  notes:            z.string().trim().max(1000).optional().or(z.literal('')),
})

export const deliveryCompleteSchema = z.object({
  actual_date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  damaged_weight_tons:  z.number().min(0, 'Phải ≥ 0').optional(),
  damage_reason:        z.string().trim().max(1000).optional().or(z.literal('')),
  delivery_cost:        z.number().min(0, 'Phải ≥ 0').optional(),
  status:               z.enum(['delivered', 'damaged', 'cancelled']),
}).refine(
  (d) => {
    if (d.damaged_weight_tons && d.damaged_weight_tons > 0) return !!d.damage_reason
    return true
  },
  { message: 'Nhập lý do hư hỏng khi có trọng lượng hư hỏng', path: ['damage_reason'] }
)

export const deliveryBaselineSchema = z.object({
  year:              z.number().int().min(2020).max(2099),
  month:             z.number().int().min(1).max(12).optional(),
  avg_cost_per_ton:  z.number({ invalid_type_error: 'Phải là số' }).min(0, 'Phải ≥ 0'),
  notes:             z.string().trim().max(500).optional().or(z.literal('')),
})

export type DeliveryCreateInput   = z.infer<typeof deliveryCreateSchema>
export type DeliveryCompleteInput = z.infer<typeof deliveryCompleteSchema>
export type DeliveryBaselineInput = z.infer<typeof deliveryBaselineSchema>

// ─── 5S Findings ─────────────────────────────────────────────────────────────

export const FIVE_S_DEPARTMENTS = ['PRODUCTION', 'COORDINATION', 'MAINTENANCE', 'ALL'] as const

export const finding5sCreateSchema = z.object({
  finding_date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  workshop:           z.union([z.enum(KPI_WORKSHOPS), z.literal('Văn phòng')], { required_error: 'Chọn xưởng/bộ phận' }),
  department:         z.enum(FIVE_S_DEPARTMENTS),
  area:               z.string().trim().max(200).optional().or(z.literal('')),
  category:           z.enum(FIVE_S_CATEGORIES, { required_error: 'Chọn loại 5S' }),
  description:        z.string().trim().min(1, 'Nhập mô tả vấn đề').max(1000),
  severity:           z.enum(SEVERITIES).default('medium'),
  due_date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  responsible_person: z.string().trim().max(100).optional().or(z.literal('')),
  photo_url:          z.string().trim().max(500).optional().or(z.literal('')),
})

export const finding5sResolveSchema = z.object({
  resolved_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  resolution_notes: z.string().trim().max(1000).optional().or(z.literal('')),
})

export type Finding5sCreateInput  = z.infer<typeof finding5sCreateSchema>
export type Finding5sResolveInput = z.infer<typeof finding5sResolveSchema>

// ─── Statistical Reports ──────────────────────────────────────────────────────

export const statReportCreateSchema = z.object({
  report_name:        z.string().trim().min(1, 'Nhập tên báo cáo').max(200),
  report_type:        z.enum(REPORT_TYPES).optional().or(z.literal('')),
  due_date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  recipient:          z.string().trim().max(200).optional().or(z.literal('')),
  responsible_person: z.string().trim().max(100).optional().or(z.literal('')),
  notes:              z.string().trim().max(1000).optional().or(z.literal('')),
})

export const statReportBulkSchema = z.object({
  report_name:        z.string().trim().min(1, 'Nhập tên báo cáo').max(200),
  report_type:        z.enum(REPORT_TYPES).optional().or(z.literal('')),
  start_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  end_date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  frequency:          z.enum(['weekly', 'monthly', 'quarterly']),
  recipient:          z.string().trim().max(200).optional().or(z.literal('')),
  responsible_person: z.string().trim().max(100).optional().or(z.literal('')),
  notes:              z.string().trim().max(1000).optional().or(z.literal('')),
}).refine(
  (d) => new Date(d.end_date) >= new Date(d.start_date),
  { message: 'Ngày kết thúc phải sau ngày bắt đầu', path: ['end_date'] }
)

export const statReportSubmitSchema = z.object({
  submitted_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  notes:          z.string().trim().max(1000).optional().or(z.literal('')),
})

export type StatReportCreateInput = z.infer<typeof statReportCreateSchema>
export type StatReportBulkInput   = z.infer<typeof statReportBulkSchema>
export type StatReportSubmitInput = z.infer<typeof statReportSubmitSchema>

// ─── ISO Procedures ───────────────────────────────────────────────────────────

export const isoCreateSchema = z.object({
  procedure_code:          z.string().trim().regex(/^[A-Z0-9\-]{5,30}$/i, 'Mã ISO phải 5-30 ký tự'),
  procedure_name:          z.string().trim().min(1, 'Nhập tên quy trình').max(200),
  category:                z.enum(ISO_CATEGORIES).optional().or(z.literal('')),
  planned_completion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  responsible_person:      z.string().trim().max(100).optional().or(z.literal('')),
  notes:                   z.string().trim().max(1000).optional().or(z.literal('')),
})

export const isoUpdateProgressSchema = z.object({
  progress_pct: z.number().min(0, 'Phải ≥ 0').max(100, 'Phải ≤ 100'),
})

export const isoCompleteSchema = z.object({
  actual_completion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  document_url:           z.string().trim().max(500).optional().or(z.literal('')),
  status:                 z.enum(['approved', 'released']),
})

export type IsoCreateInput          = z.infer<typeof isoCreateSchema>
export type IsoUpdateProgressInput  = z.infer<typeof isoUpdateProgressSchema>
export type IsoCompleteInput        = z.infer<typeof isoCompleteSchema>
