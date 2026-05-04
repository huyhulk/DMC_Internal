import { z } from 'zod'

export const DEFECT_TYPES = [
  'kich_thuoc',
  'be_mat',
  'chong_dinh',
  'son',
  'dong_goi',
  'khac',
] as const

export const DEFECT_TYPE_LABELS: Record<typeof DEFECT_TYPES[number], string> = {
  kich_thuoc: 'Sai kích thước',
  be_mat:     'Lỗi bề mặt',
  chong_dinh: 'Lỗi chống dính',
  son:        'Lỗi sơn',
  dong_goi:   'Lỗi đóng gói',
  khac:       'Khác',
}

export const SHIFT_KEYS = [
  'ca_sang_1', 'ca_sang_2', 'ca_chieu_1', 'ca_chieu_2', 'ca_tang_ca', 'khac',
] as const

export const SHIFT_LABELS: Record<typeof SHIFT_KEYS[number], string> = {
  ca_sang_1:  'Ca sáng 1 (7:30–9:30)',
  ca_sang_2:  'Ca sáng 2 (9:30–11:30)',
  ca_chieu_1: 'Ca chiều 1 (12:30–14:30)',
  ca_chieu_2: 'Ca chiều 2 (14:30–16:30)',
  ca_tang_ca: 'Tăng ca (16:30–22:00)',
  khac:       'Khác',
}

export const KPI_WORKSHOPS_FORM = ['DMC1', 'DMC3', 'DMC4', 'DMC5', 'PKT-SX'] as const

export const defectEntrySchema = z.object({
  pcode:        z.string().trim().max(50).optional().or(z.literal('')),
  product_name: z.string().trim().max(200).optional().or(z.literal('')),
  total_qty:    z.number({ invalid_type_error: 'Phải là số' }).positive('Tổng SL phải > 0'),
  defect_qty:   z.number({ invalid_type_error: 'Phải là số' }).min(0, 'SL lỗi phải ≥ 0').default(0),
  defect_type:  z.enum(DEFECT_TYPES).optional(),
  defect_cause: z.string().trim().max(500).optional().or(z.literal('')),
  unit:         z.string().trim().min(1).default('m'),
  notes:        z.string().trim().max(500).optional().or(z.literal('')),
}).refine((d) => d.defect_qty <= d.total_qty, {
  message: 'SL lỗi không được vượt tổng SL',
  path: ['defect_qty'],
})

export const defectsBulkSchema = z.object({
  shared: z.object({
    report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
    workshop:    z.enum(KPI_WORKSHOPS_FORM),
    shift:       z.enum(SHIFT_KEYS).optional(),
  }),
  rows: z.array(defectEntrySchema).min(1, 'Cần nhập ít nhất 1 dòng').max(50, 'Tối đa 50 dòng/lần submit'),
})

export type DefectEntryInput = z.infer<typeof defectEntrySchema>
export type DefectsBulkInput = z.infer<typeof defectsBulkSchema>
