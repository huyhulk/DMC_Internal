import { z } from 'zod'
import { isProductionTimeRangeValid } from '@/modules/production/workflow'

export const productLineSchema = z.object({
  product: z.string().min(1),
  pdate: z.string().min(1),
  starttime: z.string().min(1, 'Vui lòng nhập giờ bắt đầu'),
  endtime: z.string().min(1, 'Vui lòng nhập giờ kết thúc'),
  workforce: z.number().min(0).default(0),
  poutput: z.number().min(0).default(0),
  eoutput: z.number().min(0).default(0),
  routput: z.number().min(0).default(0),
  realnorm: z.number().default(0),
}).refine((line) => isProductionTimeRangeValid(line.starttime, line.endtime), {
  message: 'Giờ kết thúc phải lớn hơn giờ bắt đầu',
  path: ['endtime'],
})

export const recordProductionSchema = z.object({
  pdate: z.string().min(1, 'Vui lòng chọn ngày lập phiếu'),
  pcode: z.string().min(1, 'Vui lòng chọn mã LSX'),
  workshop: z.string().min(1, 'Vui lòng chọn xưởng'),
  isOtherTask: z.boolean().default(false),
  lines: z.array(productLineSchema).min(1),
  unlockLog: z.string().default(''),
})

export type RecordProductionInput = z.infer<typeof recordProductionSchema>
