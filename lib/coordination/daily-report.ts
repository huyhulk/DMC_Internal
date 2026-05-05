import { addDays, parse } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { formatDate, normalizeWorkshop, workshopCode } from '@/lib/utils'
import { calculateProductionCompletion } from '@/lib/production/workflow'
import { buildProductionStatusMapFromRows, applyEffectiveStatusToOrder } from '@/lib/production/status-server'
import { shouldShowOpenProductionOrder } from '@/lib/production/status'

export const DAILY_REPORT_WORKSHOPS = ['DMC1', 'DMC3', 'DMC4', 'DMC5'] as const
export type DailyReportWorkshop = typeof DAILY_REPORT_WORKSHOPS[number]
export type DailyReportType = 'plan' | 'result' | 'both'
export type ProgressEvaluation = 'ĐẠT' | 'KHÔNG ĐẠT'

export interface DailyPlanReportRow {
  stt: number
  pcode: string
  initialDate: string
  customer: string
  description: string
  quantity: number
  deadline: string
  completionPct: number
  productionPlan: string
}

export interface DailyResultReportRow {
  stt: number
  pcode: string
  customer: string
  description: string
  quantity: number
  completionTime: string
  efficiencyPct: number
  progress: ProgressEvaluation
}

export interface DailyWorkshopSummary {
  orderCount: number
  failedCount: number
  totalQuantity: number
}

export interface DailyWorkshopSection<T> {
  workshop: DailyReportWorkshop
  rows: T[]
  summary: DailyWorkshopSummary
}

export interface DailyProductionReportData {
  reportDate: string
  planDate: string
  planTitle: string
  resultTitle: string
  planSections: Array<DailyWorkshopSection<DailyPlanReportRow>>
  resultSections: Array<DailyWorkshopSection<DailyResultReportRow>>
  planTotal: DailyWorkshopSummary
  resultTotal: DailyWorkshopSummary
}

type DataRow = {
  PCODE: string
  INITIALDATE: string | null
  CUSTOMER: string | null
  WORKSHOP: string | null
  DESCRIPTION: string | null
  QUANTITY: number | null
  DEADLINEDATE: string | null
  STATUS: string | null
}

type ProductionRow = {
  pcode: string | null
  poutput: number | null
  workforce?: number | null
  starttime?: string | null
  endtime?: string | null
  realnorm?: number | null
  products?: string | null
  created_at?: string | null
  save_status?: 'draft' | 'closed' | null
}

type NormRow = {
  products: string | null
  norm: number | null
  workshop: string | null
}

export function isValidReportDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

export function resolveDailyReportWorkshop(workshop: string | null | undefined): DailyReportWorkshop | null {
  const code = workshopCode(normalizeWorkshop(workshop ?? ''))
  return DAILY_REPORT_WORKSHOPS.includes(code as DailyReportWorkshop) ? code as DailyReportWorkshop : null
}

export function calculateCompletion(quantity: number, produced: number) {
  const safeQuantity = Math.max(0, quantity)
  const safeProduced = Math.max(0, produced)
  return {
    remaining: Math.max(0, safeQuantity - safeProduced),
    completionPct: safeQuantity > 0 ? Math.min(100, Math.round((safeProduced / safeQuantity) * 1000) / 10) : (safeProduced > 0 ? 100 : 0),
  }
}

export function calculateEfficiencyPct(realnorm: number, norm: number): number {
  if (!realnorm || !norm) return 0
  return Math.round((realnorm / norm) * 1000) / 10
}

export function makeDailyReportTitles(date: string) {
  const parsed = parse(date, 'yyyy-MM-dd', new Date())
  const planDate = formatDate(addDays(parsed, 1), 'dd/MM/yyyy')
  const resultDate = formatDate(parsed, 'dd/MM/yyyy')
  return {
    planDate: formatDate(addDays(parsed, 1), 'yyyy-MM-dd'),
    planTitle: `KẾ HOẠCH SẢN XUẤT NGÀY: ${planDate}`,
    resultTitle: `KẾT QUẢ SẢN XUẤT NGÀY ${resultDate}`,
  }
}

export function groupDailyRows<T extends { quantity: number; progress?: ProgressEvaluation }>(
  rowsByWorkshop: Map<DailyReportWorkshop, T[]>,
): Array<DailyWorkshopSection<T>> {
  return DAILY_REPORT_WORKSHOPS.map((workshop) => {
    const rows = rowsByWorkshop.get(workshop) ?? []
    return {
      workshop,
      rows,
      summary: summarizeRows(rows),
    }
  })
}

export function summarizeRows<T extends { pcode?: string; quantity: number; progress?: ProgressEvaluation }>(rows: T[]): DailyWorkshopSummary {
  const pcodes = new Set(rows.map((r) => r.pcode).filter(Boolean))
  return {
    orderCount: pcodes.size || rows.length,
    failedCount: rows.filter((r) => r.progress === 'KHÔNG ĐẠT').length,
    totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
  }
}

function emptyRowsMap<T>() {
  return new Map<DailyReportWorkshop, T[]>(DAILY_REPORT_WORKSHOPS.map((workshop) => [workshop, []]))
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return ''
  const date = formatDate(deadline, 'dd/MM/yyyy')
  const time = deadline.includes('T') ? deadline.substring(11, 16) : ''
  return time ? `${date} ${time}` : date
}

function formatTimeValue(time: string | null | undefined, createdAt: string | null | undefined): string {
  if (time) return time.substring(0, 5)
  if (!createdAt) return ''
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function compareDeadline(date: string, time: string | null | undefined, createdAt: string | null | undefined, deadline: string | null | undefined): boolean {
  if (!deadline) return false
  const actual = time ? `${date}T${time.substring(0, 5)}:00` : createdAt
  if (!actual) return false
  return new Date(actual).getTime() <= new Date(deadline).getTime()
}

function buildPcodeOutputMap(rows: ProductionRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!row.pcode) continue
    map.set(row.pcode, (map.get(row.pcode) ?? 0) + (row.poutput ?? 0))
  }
  return map
}

function normKey(product: string | null | undefined, workshop: string | null | undefined): string {
  return `${product ?? ''}|||${workshopCode(normalizeWorkshop(workshop ?? ''))}`
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function fetchProductionOutputs(pcodes: string[]): Promise<ProductionRow[]> {
  if (pcodes.length === 0) return []
  const supabase = await createClient()
  const rows: ProductionRow[] = []

  for (const chunk of chunkArray([...new Set(pcodes)], 200)) {
    const { data, error } = await supabase
      .from('Production')
      .select('pcode,poutput,save_status')
      .in('pcode', chunk) as { data: ProductionRow[] | null; error: { message: string } | null }

    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
  }

  return rows
}

export async function getDailyPlanReport(date: string): Promise<Array<DailyWorkshopSection<DailyPlanReportRow>>> {
  if (!isValidReportDate(date)) throw new Error('Ngày báo cáo không hợp lệ')
  const supabase = await createClient()

  const { data: dataRows, error: dataError } = await supabase
    .from('data')
    .select('PCODE,INITIALDATE,CUSTOMER,WORKSHOP,DESCRIPTION,QUANTITY,DEADLINEDATE,STATUS')
    .order('DEADLINEDATE', { ascending: true }) as { data: DataRow[] | null; error: { message: string } | null }

  if (dataError) throw new Error(dataError.message)
  if (!dataRows?.length) return groupDailyRows(emptyRowsMap<DailyPlanReportRow>())

  const pcodes = dataRows.map((row) => row.PCODE).filter(Boolean)
  const productionRows = await fetchProductionOutputs(pcodes)
  const outputByPcode = buildPcodeOutputMap(productionRows)
  const quantityByPcode = new Map(dataRows.map((row) => [row.PCODE, row.QUANTITY ?? 0]))
  const statusMap = buildProductionStatusMapFromRows({
    pcodes,
    productionRows,
    quantityByPcode,
  })
  const rowsByWorkshop = emptyRowsMap<DailyPlanReportRow>()

  for (const source of dataRows) {
    const workshop = resolveDailyReportWorkshop(source.WORKSHOP)
    const quantity = source.QUANTITY ?? 0
    const produced = outputByPcode.get(source.PCODE) ?? 0
    const completion = calculateProductionCompletion(quantity, produced)
    const effectiveOrder = applyEffectiveStatusToOrder({
      pcode: source.PCODE,
      initialdate: source.INITIALDATE ?? '',
      workshop: normalizeWorkshop(source.WORKSHOP ?? ''),
      customer: source.CUSTOMER ?? '',
      quantity: String(quantity),
      description: source.DESCRIPTION ?? '',
      deadlinedate: source.DEADLINEDATE ?? '',
      status: source.STATUS ?? '',
    }, statusMap)
    if (!workshop || !shouldShowOpenProductionOrder({ status: effectiveOrder.status, closed: statusMap.get(source.PCODE)?.closed ?? false, completion })) continue
    const { remaining, completionPct } = calculateCompletion(quantity, produced)

    const plannedQuantity = produced > 0 ? remaining : quantity

    rowsByWorkshop.get(workshop)!.push({
      stt: 0,
      pcode: source.PCODE,
      initialDate: formatDate(source.INITIALDATE, 'dd/MM/yyyy'),
      customer: source.CUSTOMER ?? '',
      description: source.DESCRIPTION ?? '',
      quantity,
      deadline: formatDeadline(source.DEADLINEDATE),
      completionPct,
      productionPlan: plannedQuantity > 0 ? String(plannedQuantity) : '',
    })
  }

  for (const rows of rowsByWorkshop.values()) {
    rows.sort((a, b) => a.deadline.localeCompare(b.deadline) || a.initialDate.localeCompare(b.initialDate))
    rows.forEach((row, index) => { row.stt = index + 1 })
  }

  return groupDailyRows(rowsByWorkshop)
}

export async function getDailyResultReport(date: string): Promise<Array<DailyWorkshopSection<DailyResultReportRow>>> {
  if (!isValidReportDate(date)) throw new Error('Ngày báo cáo không hợp lệ')
  const supabase = await createClient()

  const { data: productionRows, error: prodError } = await supabase
    .from('Production')
    .select('pcode,poutput,workforce,starttime,endtime,realnorm,products,created_at,save_status')
    .eq('pdate', date)
    .order('created_at', { ascending: true }) as { data: ProductionRow[] | null; error: { message: string } | null }

  if (prodError) throw new Error(prodError.message)
  if (!productionRows?.length) return groupDailyRows(emptyRowsMap<DailyResultReportRow>())

  const pcodes = [...new Set(productionRows.map((row) => row.pcode).filter(Boolean))] as string[]
  const products = [...new Set(productionRows.map((row) => row.products).filter(Boolean))] as string[]

  const { data: dataRows, error: dataError } = await supabase
    .from('data')
    .select('PCODE,CUSTOMER,WORKSHOP,DESCRIPTION,QUANTITY,DEADLINEDATE,STATUS')
    .in('PCODE', pcodes) as { data: DataRow[] | null; error: { message: string } | null }

  const allProductionRows = await fetchProductionOutputs(pcodes)

  const { data: normRows, error: normError } = products.length > 0
    ? await supabase.from('Norm').select('products,norm,workshop').in('products', products) as { data: NormRow[] | null; error: { message: string } | null }
    : { data: [], error: null }

  if (dataError) throw new Error(dataError.message)
  if (normError) throw new Error(normError.message)

  const dataByPcode = new Map((dataRows ?? []).map((row) => [row.PCODE, row]))
  const outputByPcode = buildPcodeOutputMap(allProductionRows)
  const norms = new Map<string, number>()
  for (const norm of normRows ?? []) {
    norms.set(normKey(norm.products, norm.workshop), norm.norm ?? 0)
  }

  const rowsByWorkshop = emptyRowsMap<DailyResultReportRow>()

  for (const source of productionRows) {
    if (!source.pcode) continue
    const order = dataByPcode.get(source.pcode)
    const workshop = resolveDailyReportWorkshop(order?.WORKSHOP)
    if (!workshop) continue

    const quantity = order?.QUANTITY ?? 0
    const produced = outputByPcode.get(source.pcode) ?? 0
    const { completionPct } = calculateCompletion(quantity, produced)
    const norm = norms.get(normKey(source.products, workshop)) ?? 0
    const onTime = compareDeadline(date, source.endtime, source.created_at, order?.DEADLINEDATE)
    const progress: ProgressEvaluation = completionPct >= 100 || onTime ? 'ĐẠT' : 'KHÔNG ĐẠT'

    rowsByWorkshop.get(workshop)!.push({
      stt: 0,
      pcode: source.pcode,
      customer: order?.CUSTOMER ?? '',
      description: order?.DESCRIPTION ?? source.products ?? '',
      quantity: source.poutput ?? 0,
      completionTime: formatTimeValue(source.endtime, source.created_at),
      efficiencyPct: calculateEfficiencyPct(source.realnorm ?? 0, norm),
      progress,
    })
  }

  for (const rows of rowsByWorkshop.values()) {
    rows.forEach((row, index) => { row.stt = index + 1 })
  }

  return groupDailyRows(rowsByWorkshop)
}

function totalSummary(sections: Array<DailyWorkshopSection<DailyPlanReportRow | DailyResultReportRow>>): DailyWorkshopSummary {
  return {
    orderCount: sections.reduce((sum, section) => sum + section.summary.orderCount, 0),
    failedCount: sections.reduce((sum, section) => sum + section.summary.failedCount, 0),
    totalQuantity: sections.reduce((sum, section) => sum + section.summary.totalQuantity, 0),
  }
}

export async function getDailyProductionReportData(date: string): Promise<DailyProductionReportData> {
  const [planSections, resultSections] = await Promise.all([
    getDailyPlanReport(date),
    getDailyResultReport(date),
  ])
  const titles = makeDailyReportTitles(date)
  return {
    reportDate: date,
    planDate: titles.planDate,
    planTitle: titles.planTitle,
    resultTitle: titles.resultTitle,
    planSections,
    resultSections,
    planTotal: totalSummary(planSections),
    resultTotal: totalSummary(resultSections),
  }
}
