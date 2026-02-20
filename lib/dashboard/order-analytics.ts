export const FAILED_LEGACY_ALIAS = "faield"
export const PROFIT_STATUSES = ["paid", "done", "preparing"] as const
export const DELIVERY_BASE_FEE = 1000
export const DELIVERY_PER_ITEM_FEE = 130
export const DISPLAY_STATUSES = [
  "unpaid",
  "paid",
  "failed",
  "preparing",
  "done",
  "cancelled",
] as const

export type ProfitStatus = (typeof PROFIT_STATUSES)[number]
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number]
export type PresetPeriod = "1m" | "3m" | "6m" | "12m" | "custom"

export type OrderAnalyticsRow = {
  id: string
  status: string
  total_amount: number | string | null
  discount_amount: number | string | null
  created_at: string
}

export type OrderItemAnalyticsRow = {
  order_id: string
  variant_id?: string | null
  price: number | string
  quantity: number
}

export type DateRange = {
  from: Date
  to: Date
}

export type ProfitMetrics = {
  grossProfit: number
  netProfit: number
  discountTotal: number
  orderCount: number
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function dateAtStartOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function dateAtEndOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function toNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizeOrderStatus(value: string | null | undefined) {
  const clean = value?.trim().toLowerCase()
  if (!clean) return null
  if (clean === FAILED_LEGACY_ALIAS) return "failed"
  if ((DISPLAY_STATUSES as readonly string[]).includes(clean)) return clean as DisplayStatus
  return clean
}

export function buildOrderItemGrossMap(items: OrderItemAnalyticsRow[]) {
  const map = new Map<string, number>()
  for (const item of items) {
    const lineTotal = toNumber(item.price) * toNumber(item.quantity)
    map.set(item.order_id, (map.get(item.order_id) ?? 0) + lineTotal)
  }
  return map
}

export function buildOrderItemQuantityMap(items: OrderItemAnalyticsRow[]) {
  const map = new Map<string, number>()
  for (const item of items) {
    map.set(item.order_id, (map.get(item.order_id) ?? 0) + toNumber(item.quantity))
  }
  return map
}

export function deliveryForOrder(itemQuantity: number) {
  const qty = Math.max(0, toNumber(itemQuantity))
  return DELIVERY_BASE_FEE + qty * DELIVERY_PER_ITEM_FEE
}

export function discountForOrder(order: OrderAnalyticsRow, itemSubtotal: number) {
  const rawDiscount = Math.max(0, toNumber(order.discount_amount))
  const safeSubtotal = Math.max(0, itemSubtotal)
  return Math.min(rawDiscount, safeSubtotal)
}

export function grossForOrder(
  order: OrderAnalyticsRow,
  itemSubtotalMap: Map<string, number>,
  itemQuantityMap: Map<string, number>
) {
  // total_amount already includes items + delivery
  if (order.total_amount !== null && order.total_amount !== undefined && String(order.total_amount).trim() !== "") {
    return toNumber(order.total_amount)
  }

  const itemsSubtotal = itemSubtotalMap.get(order.id)
  const itemQuantity = itemQuantityMap.get(order.id)
  if (typeof itemsSubtotal === "number" && typeof itemQuantity === "number") {
    return itemsSubtotal + deliveryForOrder(itemQuantity)
  }

  return 0
}

export function netForOrder(
  order: OrderAnalyticsRow,
  itemSubtotalMap: Map<string, number>,
  itemQuantityMap: Map<string, number>
) {
  const itemSubtotal = itemSubtotalMap.get(order.id)
  const appliedDiscount = typeof itemSubtotal === "number" ? discountForOrder(order, itemSubtotal) : 0

  const itemQuantity = itemQuantityMap.get(order.id)
  if (typeof itemQuantity === "number") {
    // requested rule: net = total (after discount) - delivery
    return toNumber(order.total_amount) - deliveryForOrder(itemQuantity)
  }

  // fallback when quantity is unavailable:
  if (typeof itemSubtotal === "number") {
    return itemSubtotal - appliedDiscount
  }

  return toNumber(order.total_amount)
}

export function formatMoney(value: number) {
  return value.toFixed(2)
}

export function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

export function monthLabelFromKey(key: string) {
  const [year, month] = key.split("-").map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" })
}

export function getPresetRange(period: Exclude<PresetPeriod, "custom">, now = new Date()): DateRange {
  const to = dateAtEndOfDay(now)
  const from = new Date(now)
  if (period === "1m") from.setMonth(from.getMonth() - 1)
  if (period === "3m") from.setMonth(from.getMonth() - 3)
  if (period === "6m") from.setMonth(from.getMonth() - 6)
  if (period === "12m") from.setMonth(from.getMonth() - 12)
  return { from: dateAtStartOfDay(from), to }
}

export function getCustomRange(fromDateString: string, toDateString: string): DateRange | null {
  const fromDate = new Date(fromDateString)
  const toDate = new Date(toDateString)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null
  if (fromDate.getTime() > toDate.getTime()) return null
  return { from: dateAtStartOfDay(fromDate), to: dateAtEndOfDay(toDate) }
}

export function dateInputString(date: Date) {
  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  return `${year}-${month}-${day}`
}

export function inDateRange(dateString: string, range: DateRange) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return false
  return date.getTime() >= range.from.getTime() && date.getTime() <= range.to.getTime()
}

export function summarizeProfit(
  orders: OrderAnalyticsRow[],
  itemSubtotalMap: Map<string, number>,
  itemQuantityMap: Map<string, number>,
  allowedStatuses: readonly string[],
  range: DateRange
): ProfitMetrics {
  let grossProfit = 0
  let netProfit = 0
  let discountTotal = 0
  let orderCount = 0

  for (const order of orders) {
    const status = normalizeOrderStatus(order.status)
    if (!status || !allowedStatuses.includes(status)) continue
    if (!inDateRange(order.created_at, range)) continue

    grossProfit += grossForOrder(order, itemSubtotalMap, itemQuantityMap)
    netProfit += netForOrder(order, itemSubtotalMap, itemQuantityMap)
    const itemSubtotal = itemSubtotalMap.get(order.id)
    discountTotal += discountForOrder(order, typeof itemSubtotal === "number" ? itemSubtotal : Infinity)
    orderCount += 1
  }

  return {
    grossProfit,
    discountTotal,
    netProfit,
    orderCount,
  }
}

export function buildStatusCount(
  orders: OrderAnalyticsRow[],
  allowedStatuses = DISPLAY_STATUSES as readonly string[],
  range?: DateRange
) {
  const map = new Map<string, number>()
  for (const status of allowedStatuses) map.set(status, 0)

  for (const order of orders) {
    const status = normalizeOrderStatus(order.status)
    if (!status || !allowedStatuses.includes(status)) continue
    if (range && !inDateRange(order.created_at, range)) continue
    map.set(status, (map.get(status) ?? 0) + 1)
  }

  return map
}

export function buildMonthlyProfitSeries(
  orders: OrderAnalyticsRow[],
  itemSubtotalMap: Map<string, number>,
  itemQuantityMap: Map<string, number>,
  range: DateRange,
  allowedStatuses: readonly string[]
) {
  const monthData = new Map<
    string,
    { monthKey: string; label: string; gross: number; net: number; orders: number }
  >()

  const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1)
  const end = new Date(range.to.getFullYear(), range.to.getMonth(), 1)
  while (cursor.getTime() <= end.getTime()) {
    const key = formatMonthKey(cursor)
    monthData.set(key, {
      monthKey: key,
      label: monthLabelFromKey(key),
      gross: 0,
      net: 0,
      orders: 0,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  for (const order of orders) {
    const status = normalizeOrderStatus(order.status)
    if (!status || !allowedStatuses.includes(status)) continue
    if (!inDateRange(order.created_at, range)) continue

    const createdAt = new Date(order.created_at)
    if (Number.isNaN(createdAt.getTime())) continue
    const key = formatMonthKey(createdAt)
    const current = monthData.get(key)
    if (!current) continue

    const gross = grossForOrder(order, itemSubtotalMap, itemQuantityMap)
    const net = netForOrder(order, itemSubtotalMap, itemQuantityMap)
    current.gross += gross
    current.net += net
    current.orders += 1
  }

  return Array.from(monthData.values())
}
