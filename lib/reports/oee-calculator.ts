/**
 * Tính Duration (giờ) từ chuỗi HH:mm
 */
export function durationHours(starttime: string, endtime: string): number {
  const [sh, sm] = starttime.split(':').map(Number)
  const [eh, em] = endtime.split(':').map(Number)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0
  const diff = (eh * 60 + em) - (sh * 60 + sm)
  return diff > 0 ? diff / 60 : 0
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

/**
 * Phân loại ca sản xuất dựa trên starttime (HH:mm)
 * Ca sáng 1: 7:30–9:30, Ca sáng 2: 9:30–11:30
 * Ca chiều 1: 12:30–14:30, Ca chiều 2: 14:30–16:30
 */
export function classifyShift(
  starttime: string,
): 'ca_sang_1' | 'ca_sang_2' | 'ca_chieu_1' | 'ca_chieu_2' | 'khac' {
  if (!starttime) return 'khac'
  const [h, m] = starttime.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return 'khac'
  const totalMin = h * 60 + m
  if (totalMin >= 450 && totalMin < 570) return 'ca_sang_1'   // 7:30–9:30
  if (totalMin >= 570 && totalMin < 690) return 'ca_sang_2'   // 9:30–11:30
  if (totalMin >= 750 && totalMin < 870) return 'ca_chieu_1'  // 12:30–14:30
  if (totalMin >= 870 && totalMin < 990) return 'ca_chieu_2'  // 14:30–16:30
  return 'khac'
}
