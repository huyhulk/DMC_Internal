import {
  durationHours,
  calcA,
  calcP,
  calcQ,
  calcOEE,
  weightedAvg,
  classifyShift,
} from '../oee-calculator'

describe('durationHours', () => {
  it('tính đúng 2 giờ từ 7:30 đến 9:30', () => {
    expect(durationHours('07:30', '09:30')).toBe(2)
  })
  it('trả về 0 khi endtime <= starttime', () => {
    expect(durationHours('09:30', '07:30')).toBe(0)
  })
  it('trả về 0 khi chuỗi không hợp lệ', () => {
    expect(durationHours('', '09:30')).toBe(0)
    expect(durationHours('abc', 'xyz')).toBe(0)
  })
  it('tính đúng 1.5 giờ', () => {
    expect(durationHours('08:00', '09:30')).toBe(1.5)
  })
})

describe('calcA — Khả năng hoạt động', () => {
  it('trả về 0 khi pspeed = 0', () => {
    expect(calcA(100, 0, 2)).toBe(0)
  })
  it('trả về 0 khi duration = 0', () => {
    expect(calcA(100, 500, 0)).toBe(0)
  })
  it('giới hạn tối đa = 1 khi sản lượng vượt kế hoạch', () => {
    // pspeed=500/h, 2h → kế hoạch=1000, thực tế=1500 → A = 1
    expect(calcA(1500, 500, 2)).toBe(1)
  })
  it('800 / (500 × 2) = 0.8', () => {
    expect(calcA(800, 500, 2)).toBeCloseTo(0.8, 9)
  })
})

describe('calcP — Hiệu suất thiết bị', () => {
  it('trả về 0 khi norm = 0', () => {
    expect(calcP(1.5, 0)).toBe(0)
  })
  it('giới hạn tối đa = 1', () => {
    expect(calcP(2.0, 1.5)).toBe(1)
  })
  it('1.2 / 1.5 = 0.8', () => {
    expect(calcP(1.2, 1.5)).toBeCloseTo(0.8, 9)
  })
})

describe('calcQ — Tỷ lệ chất lượng', () => {
  it('trả về 0 khi poutput = 0', () => {
    expect(calcQ(0, 0, 0)).toBe(0)
  })
  it('trả về 1 khi không có lỗi hoặc tái chế', () => {
    expect(calcQ(1000, 0, 0)).toBe(1)
  })
  it('không cho kết quả âm khi lỗi > sản lượng', () => {
    expect(calcQ(100, 80, 50)).toBe(0)
  })
  it('(1000-50-30)/1000 = 0.92', () => {
    expect(calcQ(1000, 50, 30)).toBeCloseTo(0.92, 9)
  })
})

describe('calcOEE', () => {
  it('OEE = A × P × Q', () => {
    // 0.9 × 0.8 × 0.95 = 0.684
    expect(calcOEE(0.9, 0.8, 0.95)).toBeCloseTo(0.684, 9)
  })
  it('OEE = 0 nếu bất kỳ thành phần = 0', () => {
    expect(calcOEE(0, 0.8, 0.9)).toBe(0)
    expect(calcOEE(0.9, 0, 0.9)).toBe(0)
    expect(calcOEE(0.9, 0.8, 0)).toBe(0)
  })
})

describe('weightedAvg — Trung bình có trọng số', () => {
  it('trả về 0 khi mảng rỗng', () => {
    expect(weightedAvg([])).toBe(0)
  })
  it('trả về 0 khi tổng trọng số = 0', () => {
    expect(weightedAvg([{ value: 0.8, weight: 0 }])).toBe(0)
  })
  it('(0.9×1000 + 0.5×500) / 1500 ≈ 0.7667', () => {
    const result = weightedAvg([
      { value: 0.9, weight: 1000 },
      { value: 0.5, weight: 500 },
    ])
    expect(result).toBeCloseTo(1150 / 1500, 9)
  })
  it('dùng weighted avg — khác trung bình cộng đơn', () => {
    // Weight 10:1 → gần bằng value của record nặng hơn
    const result = weightedAvg([
      { value: 1.0, weight: 1000 },
      { value: 0.0, weight: 100 },
    ])
    // Weighted ≈ 0.909, simple avg = 0.5
    expect(result).toBeGreaterThan(0.8)
  })
})

describe('classifyShift', () => {
  it('07:30 → ca_sang_1', () => { expect(classifyShift('07:30')).toBe('ca_sang_1') })
  it('09:00 → ca_sang_1', () => { expect(classifyShift('09:00')).toBe('ca_sang_1') })
  it('09:30 → ca_sang_2', () => { expect(classifyShift('09:30')).toBe('ca_sang_2') })
  it('11:00 → ca_sang_2', () => { expect(classifyShift('11:00')).toBe('ca_sang_2') })
  it('12:30 → ca_chieu_1', () => { expect(classifyShift('12:30')).toBe('ca_chieu_1') })
  it('14:30 → ca_chieu_2', () => { expect(classifyShift('14:30')).toBe('ca_chieu_2') })
  it('06:00 → khac', () => { expect(classifyShift('06:00')).toBe('khac') })
  it('17:00 → khac', () => { expect(classifyShift('17:00')).toBe('khac') })
  it('chuỗi rỗng → khac', () => { expect(classifyShift('')).toBe('khac') })
})
