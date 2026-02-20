"use client"

import * as React from "react"
import { RefreshCw } from "lucide-react"

import { supabase } from "@/lib/supabase/client"
import {
  PROFIT_STATUSES,
  buildMonthlyProfitSeries,
  buildOrderItemGrossMap,
  buildOrderItemQuantityMap,
  dateInputString,
  discountForOrder,
  formatMoney,
  getCustomRange,
  getPresetRange,
  grossForOrder,
  inDateRange,
  netForOrder,
  normalizeOrderStatus,
  summarizeProfit,
  toNumber,
  type OrderAnalyticsRow,
  type OrderItemAnalyticsRow,
  type ProfitStatus,
  type PresetPeriod,
} from "@/lib/dashboard/order-analytics"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type StatusMetricsRow = {
  status: string
  orders: number
  gross: number
  discount: number
  net: number
}

type AnalyticsOrderRow = OrderAnalyticsRow & {
  user_id: string | null
  first_name: string | null
  second_name: string | null
  email: string | null
}

type VariantMetaRow = {
  id: string
  sku: string | null
  product_id: string
  size_id: string | null
  color_id: string | null
}

type NameRow = {
  id: string
  name: string
}

type VariantRankRow = {
  variantId: string
  label: string
  quantity: number
  orders: number
  revenue: number
}

type ClientRankRow = {
  userId: string
  name: string
  email: string | null
  orders: number
  itemQty: number
  gross: number
  net: number
}

function statusLabel(status: string) {
  if (status === "paid") return "Paid"
  if (status === "done") return "Done"
  if (status === "preparing") return "Preparing"
  return status
}

function isProfitStatus(status: string | null): status is ProfitStatus {
  return !!status && (PROFIT_STATUSES as readonly string[]).includes(status)
}

const EMPTY_STATUS_METRICS: StatusMetricsRow[] = PROFIT_STATUSES.map((status) => ({
  status,
  orders: 0,
  gross: 0,
  discount: 0,
  net: 0,
}))

export default function AnalyticsClient() {
  const [orders, setOrders] = React.useState<AnalyticsOrderRow[]>([])
  const [items, setItems] = React.useState<OrderItemAnalyticsRow[]>([])
  const [variants, setVariants] = React.useState<VariantMetaRow[]>([])
  const [products, setProducts] = React.useState<NameRow[]>([])
  const [sizes, setSizes] = React.useState<NameRow[]>([])
  const [colors, setColors] = React.useState<NameRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [period, setPeriod] = React.useState<PresetPeriod>("3m")
  const [customFrom, setCustomFrom] = React.useState(() => dateInputString(getPresetRange("1m").from))
  const [customTo, setCustomTo] = React.useState(() => dateInputString(new Date()))

  const loadAnalytics = React.useCallback(async () => {
    setError(null)
    setLoading(true)

    const [
      { data: orderData, error: orderError },
      { data: itemData, error: itemError },
      { data: variantData, error: variantError },
      { data: productData, error: productError },
      { data: sizeData, error: sizeError },
      { data: colorData, error: colorError },
    ] =
      await Promise.all([
        supabase
          .from("orders")
          .select("id,user_id,first_name,second_name,email,status,total_amount,discount_amount,created_at")
          .order("created_at", { ascending: false }),
        supabase.from("order_items").select("order_id,variant_id,price,quantity"),
        supabase
          .from("product_variants")
          .select("id,sku,product_id,size_id,color_id"),
        supabase.from("products").select("id,name"),
        supabase.from("sizes").select("id,name"),
        supabase.from("colors").select("id,name"),
      ])

    setLoading(false)

    if (orderError) {
      setError(orderError.message)
      return
    }
    if (itemError) {
      setError(itemError.message)
      return
    }
    if (variantError) {
      setError(variantError.message)
      return
    }
    if (productError) {
      setError(productError.message)
      return
    }
    if (sizeError) {
      setError(sizeError.message)
      return
    }
    if (colorError) {
      setError(colorError.message)
      return
    }

    setOrders((orderData ?? []) as AnalyticsOrderRow[])
    setItems((itemData ?? []) as OrderItemAnalyticsRow[])
    setVariants((variantData ?? []) as VariantMetaRow[])
    setProducts((productData ?? []) as NameRow[])
    setSizes((sizeData ?? []) as NameRow[])
    setColors((colorData ?? []) as NameRow[])
  }, [])

  React.useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const itemSubtotalMap = React.useMemo(() => buildOrderItemGrossMap(items), [items])
  const itemQuantityMap = React.useMemo(() => buildOrderItemQuantityMap(items), [items])

  const selectedRange = React.useMemo(() => {
    if (period === "custom") return getCustomRange(customFrom, customTo)
    return getPresetRange(period)
  }, [period, customFrom, customTo])

  const rangeError =
    period === "custom" && !selectedRange
      ? "Invalid custom range. Ensure both dates are valid and the start date is before the end date."
      : null

  const summary = React.useMemo(() => {
    if (!selectedRange) {
      return { orderCount: 0, grossProfit: 0, discountTotal: 0, netProfit: 0 }
    }
    return summarizeProfit(orders, itemSubtotalMap, itemQuantityMap, PROFIT_STATUSES, selectedRange)
  }, [orders, itemSubtotalMap, itemQuantityMap, selectedRange])

  const monthlySeries = React.useMemo(() => {
    if (!selectedRange) return []
    return buildMonthlyProfitSeries(orders, itemSubtotalMap, itemQuantityMap, selectedRange, PROFIT_STATUSES)
  }, [orders, itemSubtotalMap, itemQuantityMap, selectedRange])

  const maxMonthlyValue = React.useMemo(() => {
    if (monthlySeries.length === 0) return 1
    return Math.max(
      1,
      ...monthlySeries.map((row) => Math.max(row.gross, row.net))
    )
  }, [monthlySeries])

  const statusMetrics = React.useMemo(() => {
    if (!selectedRange) return EMPTY_STATUS_METRICS

    const map = new Map<string, StatusMetricsRow>()
    for (const status of PROFIT_STATUSES) {
      map.set(status, { status, orders: 0, gross: 0, discount: 0, net: 0 })
    }

    for (const order of orders) {
      const status = normalizeOrderStatus(order.status)
      if (!isProfitStatus(status)) continue
      if (!inDateRange(order.created_at, selectedRange)) continue

      const row = map.get(status)
      if (!row) continue

      const gross = grossForOrder(order, itemSubtotalMap, itemQuantityMap)
      const itemSubtotal = itemSubtotalMap.get(order.id)
      const discount = discountForOrder(order, typeof itemSubtotal === "number" ? itemSubtotal : Infinity)
      const net = netForOrder(order, itemSubtotalMap, itemQuantityMap)

      row.orders += 1
      row.gross += gross
      row.discount += discount
      row.net += net
    }

    return PROFIT_STATUSES.map((status) => map.get(status)!)
  }, [orders, itemSubtotalMap, itemQuantityMap, selectedRange])

  const variantLabelById = React.useMemo(() => {
    const productById = new Map(products.map((row) => [row.id, row.name]))
    const sizeById = new Map(sizes.map((row) => [row.id, row.name]))
    const colorById = new Map(colors.map((row) => [row.id, row.name]))
    const labelById = new Map<string, string>()

    for (const variant of variants) {
      const productName = productById.get(variant.product_id) ?? "Unknown Product"
      const sizeName = variant.size_id ? sizeById.get(variant.size_id) : null
      const colorName = variant.color_id ? colorById.get(variant.color_id) : null

      const parts = [productName]
      if (sizeName) parts.push(sizeName)
      if (colorName) parts.push(colorName)

      const base = parts.join(" / ")
      const label = variant.sku ? `${variant.sku} - ${base}` : base
      labelById.set(variant.id, label)
    }

    return labelById
  }, [variants, products, sizes, colors])

  const scopedOrderMap = React.useMemo(() => {
    const map = new Map<string, AnalyticsOrderRow>()
    if (!selectedRange) return map

    for (const order of orders) {
      const status = normalizeOrderStatus(order.status)
      if (!isProfitStatus(status)) continue
      if (!inDateRange(order.created_at, selectedRange)) continue
      map.set(order.id, order)
    }

    return map
  }, [orders, selectedRange])

  const topSoldVariants = React.useMemo(() => {
    const acc = new Map<
      string,
      { variantId: string; quantity: number; revenue: number; orderIds: Set<string> }
    >()

    for (const item of items) {
      if (!item.variant_id) continue
      const scopedOrder = scopedOrderMap.get(item.order_id)
      if (!scopedOrder) continue

      const quantity = toNumber(item.quantity)
      const revenue = toNumber(item.price) * quantity
      const current =
        acc.get(item.variant_id) ??
        { variantId: item.variant_id, quantity: 0, revenue: 0, orderIds: new Set<string>() }

      current.quantity += quantity
      current.revenue += revenue
      current.orderIds.add(item.order_id)
      acc.set(item.variant_id, current)
    }

    return Array.from(acc.values())
      .map<VariantRankRow>((row) => ({
        variantId: row.variantId,
        label: variantLabelById.get(row.variantId) ?? row.variantId,
        quantity: row.quantity,
        orders: row.orderIds.size,
        revenue: row.revenue,
      }))
      .sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity
        if (b.orders !== a.orders) return b.orders - a.orders
        return b.revenue - a.revenue
      })
      .slice(0, 10)
  }, [items, scopedOrderMap, variantLabelById])

  const mostActiveClients = React.useMemo(() => {
    const acc = new Map<string, ClientRankRow>()

    for (const order of scopedOrderMap.values()) {
      if (!order.user_id) continue

      const fullName = `${order.first_name ?? ""} ${order.second_name ?? ""}`.trim()
      const current =
        acc.get(order.user_id) ??
        {
          userId: order.user_id,
          name: fullName || order.email || order.user_id,
          email: order.email ?? null,
          orders: 0,
          itemQty: 0,
          gross: 0,
          net: 0,
        }

      current.orders += 1
      current.itemQty += itemQuantityMap.get(order.id) ?? 0
      current.gross += grossForOrder(order, itemSubtotalMap, itemQuantityMap)
      current.net += netForOrder(order, itemSubtotalMap, itemQuantityMap)

      acc.set(order.user_id, current)
    }

    return Array.from(acc.values())
      .sort((a, b) => {
        if (b.orders !== a.orders) return b.orders - a.orders
        if (b.itemQty !== a.itemQty) return b.itemQty - a.itemQty
        return b.net - a.net
      })
      .slice(0, 10)
  }, [scopedOrderMap, itemQuantityMap, itemSubtotalMap])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            Profit Analytics (Statuses: Paid, Done, Preparing)
          </CardTitle>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Select value={period} onValueChange={(value) => setPeriod(value as PresetPeriod)}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">Last 1 Month</SelectItem>
                <SelectItem value="3m">Last 3 Months</SelectItem>
                <SelectItem value="6m">Last 6 Months</SelectItem>
                <SelectItem value="12m">Last 12 Months</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={loadAnalytics} disabled={loading} className="w-full sm:w-auto">
              <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {period === "custom" ? (
            <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="custom-from" className="text-sm font-medium">
                  From
                </label>
                <Input
                  id="custom-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="custom-to" className="text-sm font-medium">
                  To
                </label>
                <Input
                  id="custom-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {rangeError ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
              {rangeError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Orders In Scope</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{summary.orderCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gross Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{formatMoney(summary.grossProfit)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Discount Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{formatMoney(summary.discountTotal)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{formatMoney(summary.netProfit)}</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gross vs Net Profit by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlySeries.length === 0 ? (
              <div className="text-sm text-muted-foreground">No profit data for the selected period.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded bg-sky-500" />
                    Gross
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded bg-emerald-500" />
                    Net
                  </span>
                </div>

                <div className="flex h-56 items-end gap-3">
                  {monthlySeries.map((row) => {
                    const grossHeight = (row.gross / maxMonthlyValue) * 100
                    const netHeight = (row.net / maxMonthlyValue) * 100
                    return (
                      <div key={row.monthKey} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-44 w-full items-end gap-1">
                          <div className="w-1/2 rounded-t bg-sky-500/80" style={{ height: `${grossHeight}%` }} />
                          <div
                            className="w-1/2 rounded-t bg-emerald-500/80"
                            style={{ height: `${netHeight}%` }}
                          />
                        </div>
                        <div className="text-center text-[11px] text-muted-foreground">{row.label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profit Breakdown by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusMetrics.map((row) => (
                    <TableRow key={row.status}>
                      <TableCell className="font-medium">{statusLabel(row.status)}</TableCell>
                      <TableCell>{row.orders}</TableCell>
                      <TableCell>{formatMoney(row.gross)}</TableCell>
                      <TableCell>{formatMoney(row.discount)}</TableCell>
                      <TableCell>{formatMoney(row.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most Sold Variants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead>Qty Sold</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSoldVariants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                        No variant sales in selected period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    topSoldVariants.map((row) => (
                      <TableRow key={row.variantId}>
                        <TableCell className="max-w-xl">
                          <div className="line-clamp-1 font-medium">{row.label}</div>
                          <div className="font-mono text-xs text-muted-foreground">{row.variantId}</div>
                        </TableCell>
                        <TableCell>{row.quantity}</TableCell>
                        <TableCell>{row.orders}</TableCell>
                        <TableCell>{formatMoney(row.revenue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most Active Clients (Most Ordering)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Items Qty</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mostActiveClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        No clients in selected period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    mostActiveClients.map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell className="max-w-sm">
                          <div className="font-medium">{row.name}</div>
                          <div className="text-xs text-muted-foreground">{row.email ?? "-"}</div>
                          <div className="font-mono text-xs text-muted-foreground">{row.userId}</div>
                        </TableCell>
                        <TableCell>{row.orders}</TableCell>
                        <TableCell>{row.itemQty}</TableCell>
                        <TableCell>{formatMoney(row.gross)}</TableCell>
                        <TableCell>{formatMoney(row.net)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
