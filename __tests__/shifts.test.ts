import { classifyShift, toIsoWeekKey, toPeriodKey } from '@/lib/shifts'

// ── toIsoWeekKey ─────────────────────────────────────────────────────────

describe('toIsoWeekKey — ISO 8601 (Thứ 2 = đầu tuần)', () => {
  test.each([
    // [input, expected, ghi chú]
    ['2026-01-01', '2026-W01', 'Thứ 5 → W01'],
    ['2025-12-29', '2026-W01', 'Thứ 2 cuối 2025 → thuộc ISO year 2026 W01'],
    ['2024-12-31', '2025-W01', 'Thứ 3 cuối 2024 → thuộc ISO year 2025 W01'],
    ['2026-04-21', '2026-W17', 'Thứ 3 thông thường'],
    ['2026-01-04', '2026-W01', 'Chủ nhật → W01 (lịch Mỹ cho W02, ISO cho W01)'],
    ['2026-01-05', '2026-W02', 'Thứ 2 đầu tuần 2'],
    ['2026-12-28', '2026-W53', 'Thứ 2, tuần 53 ISO 2026'],
    ['2026-12-31', '2026-W53', 'Thứ 5 cuối năm 2026'],
    ['2020-12-31', '2020-W53', 'Thứ 5 cuối 2020 — năm nhuận ISO'],
    ['2021-01-03', '2020-W53', 'Chủ nhật 2021 → vẫn thuộc tuần 53 của 2020'],
    ['2021-01-04', '2021-W01', 'Thứ 2 đầu 2021 → W01 đúng'],
  ])('%s → %s (%s)', (input, expected) => {
    expect(toIsoWeekKey(input)).toBe(expected)
  })
})

// ── classifyShift ────────────────────────────────────────────────────────

describe('classifyShift — phân loại ca theo starttime', () => {
  // Ca sáng 1: 07:30–09:30
  test.each([
    ['07:30', 'ca_sang_1'],
    ['08:00', 'ca_sang_1'],
    ['09:29', 'ca_sang_1'],
  ])('"%s" → ca_sang_1', (input, expected) => {
    expect(classifyShift(input)).toBe(expected)
  })

  // Ca sáng 2: 09:30–11:30
  test.each([
    ['09:30', 'ca_sang_2'],
    ['10:00', 'ca_sang_2'],
    ['11:29', 'ca_sang_2'],
  ])('"%s" → ca_sang_2', (input, expected) => {
    expect(classifyShift(input)).toBe(expected)
  })

  // Ca chiều 1: 12:30–14:30
  test.each([
    ['12:30', 'ca_chieu_1'],
    ['13:00', 'ca_chieu_1'],
    ['14:29', 'ca_chieu_1'],
  ])('"%s" → ca_chieu_1', (input, expected) => {
    expect(classifyShift(input)).toBe(expected)
  })

  // Ca chiều 2: 14:30–16:30
  test.each([
    ['14:30', 'ca_chieu_2'],
    ['15:00', 'ca_chieu_2'],
    ['16:29', 'ca_chieu_2'],
  ])('"%s" → ca_chieu_2', (input, expected) => {
    expect(classifyShift(input)).toBe(expected)
  })

  // Ca tăng ca: 16:30–22:00
  test.each([
    ['16:30', 'ca_tang_ca'],
    ['19:00', 'ca_tang_ca'],
    ['21:59', 'ca_tang_ca'],
  ])('"%s" → ca_tang_ca', (input, expected) => {
    expect(classifyShift(input)).toBe(expected)
  })

  // Ngoài ca / edge cases
  test.each([
    ['22:00', 'khac', 'Hết tăng ca'],
    ['06:00', 'khac', 'Trước ca sáng'],
    ['11:30', 'khac', 'Giữa hai ca (nghỉ trưa)'],
    ['12:29', 'khac', 'Chưa vào ca chiều 1'],
    // Input không hợp lệ
    ['',      'khac', 'Empty string'],
    ['abc',   'khac', 'Không phải giờ'],
    ['07',    'khac', 'Thiếu phần phút'],
    ['7:30',  'ca_sang_1', 'Không padding — vẫn parse đúng'],
    ['07:30:00', 'ca_sang_1', 'Có giây — lấy HH:mm bỏ giây'],
    ['14:30:59', 'ca_chieu_2', 'Có giây — parse đúng'],
  ])('"%s" → %s (%s)', (input, expected) => {
    expect(classifyShift(input)).toBe(expected)
  })

  test('null → khac', () => {
    expect(classifyShift(null as unknown as string)).toBe('khac')
  })

  test('undefined → khac', () => {
    expect(classifyShift(undefined as unknown as string)).toBe('khac')
  })
})

// ── toPeriodKey ───────────────────────────────────────────────────────────

describe('toPeriodKey — chuyển pdate thành period key', () => {
  test('day → YYYY-MM-DD',    () => expect(toPeriodKey('2026-04-21', 'day')).toBe('2026-04-21'))
  test('week → ISO W key',    () => expect(toPeriodKey('2026-04-21', 'week')).toBe('2026-W17'))
  test('month → YYYY-MM',     () => expect(toPeriodKey('2026-04-21', 'month')).toBe('2026-04'))
  test('year → YYYY',         () => expect(toPeriodKey('2026-04-21', 'year')).toBe('2026'))
  test('empty pdate → "?"',   () => expect(toPeriodKey('', 'day')).toBe('?'))
})
