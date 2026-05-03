/**
 * Tính Duration (giờ) từ chuỗi HH:mm
 */
export function durationHours(starttime: string, endtime: string): number {
  const [sh, sm] = starttime.split(':').map(Number)
  const [eh, em] = endtime.split(':').map(Number)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0
  const startMinutes = sh * 60 + sm
  let endMinutes = eh * 60 + em
  if (endMinutes <= startMinutes) endMinutes += 24 * 60
  const diff = endMinutes - startMinutes
  return diff / 60
}

/**
 * A (Khả năng hoạt động) = (poutput / pspeed) / durationHours
 * Giới hạn tối đa = 1.0
 * Công thức: thời gian thực tế sản xuất / thời gian kế hoạch
 */
export function calcA(poutput: number, pspeed: number, hours: number): number {
  if (pspeed <= 0 || hours <= 0) return 0
  return Math.min(poutput / (pspeed * hours), 1)
}

/**
 * P (Hiệu suất thiết bị) = realnorm / norm
 * Giới hạn tối đa = 1.0
 */
export function calcP(realnorm: number, norm: number): number {
  if (norm <= 0) return 0
  return Math.min(realnorm / norm, 1)
}

/**
 * Q (Tỷ lệ chất lượng) = (poutput - eoutput - routput) / poutput
 * Giới hạn [0, 1]
 */
export function calcQ(poutput: number, eoutput: number, routput: number): number {
  if (poutput <= 0) return 0
  return Math.max(0, Math.min((poutput - eoutput - routput) / poutput, 1))
}

/**
 * OEE = A × P × Q
 */
export function calcOEE(A: number, P: number, Q: number): number {
  return A * P * Q
}

/**
 * Trung bình có trọng số — dùng khi roll-up từ dòng sản xuất lên xưởng
 * weight = poutput (sản lượng), KHÔNG dùng trung bình cộng đơn thuần
 */
export function weightedAvg(records: Array<{ value: number; weight: number }>): number {
  const totalWeight = records.reduce((s, r) => s + r.weight, 0)
  if (totalWeight <= 0) return 0
  return records.reduce((s, r) => s + r.value * r.weight, 0) / totalWeight
}

// classifyShift đã chuyển sang lib/shifts.ts — import từ đó để dùng.
