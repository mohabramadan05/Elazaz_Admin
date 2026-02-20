"use client"

import * as React from "react"
import { RefreshCw } from "lucide-react"

import { supabase } from "@/lib/supabase/client"
import {
  DISPLAY_STATUSES,
  PROFIT_STATUSES,
  buildMonthlyProfitSeries,
  buildOrderItemGrossMap,
  buildOrderItemQuantityMap,
  buildStatusCount,
  formatMoney,
  getPresetRange,
  summarizeProfit,
  type OrderAnalyticsRow,
  type OrderItemAnalyticsRow,
} from "@/lib/dashboard/order-analytics"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function statusLabel(status: string) {
  if (status === "unpaid") return "Unpaid"
  if (status === "paid") return "Paid"
  if (status === "failed") return "Failed"
  if (status === "preparing") return "Preparing"
  if (status === "done") return "Done"
  if (status === "cancelled") return "Cancelled"
  return status
}

function statusColor(status: string) {
  if (status === "unpaid") return "bg-amber-500"
  if (status === "paid") return "bg-emerald-500"
  if (status === "failed") return "bg-rose-500"
  if (status === "preparing") return "bg-blue-500"
  if (status === "done") return "bg-violet-500"
  if (status === "cancelled") return "bg-slate-500"
  return "bg-muted-foreground"
}

export default function DashboardOverviewClient() {
  const [orders, setOrders] = React.useState<OrderAnalyticsRow[]>([])
  const [items, setItems] = React.useState<OrderItemAnalyticsRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadOverview = React.useCallback(async () => {
    setError(null)
    setLoading(true)

    const [{ data: orderData, error: orderError }, { data: itemData, error: itemError }] =
      await Promise.all([
        supabase
          .from("orders")
          .select("id,status,total_amount,discount_amount,created_at")
          .order("created_at", { ascending: false }),
        supabase.from("order_items").select("order_id,variant_id,price,quantity"),
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

    setOrders((orderData ?? []) as OrderAnalyticsRow[])
    setItems((itemData ?? []) as OrderItemAnalyticsRow[])
  }, [])

  React.useEffect(() => {
    loadOverview()
  }, [loadOverview])

  const itemSubtotalMap = React.useMemo(() => buildOrderItemGrossMap(items), [items])
  const itemQuantityMap = React.useMemo(() => buildOrderItemQuantityMap(items), [items])
  const last30DaysRange = React.useMemo(() => getPresetRange("1m"), [])
  const last6MonthsRange = React.useMemo(() => getPresetRange("6m"), [])

  const profit30Days = React.useMemo(
    () => summarizeProfit(orders, itemSubtotalMap, itemQuantityMap, PROFIT_STATUSES, last30DaysRange),
    [orders, itemSubtotalMap, itemQuantityMap, last30DaysRange]
  )

  const statusCount30Days = React.useMemo(
    () => buildStatusCount(orders, DISPLAY_STATUSES, last30DaysRange),
    [orders, last30DaysRange]
  )

  const monthlyNetSeries = React.useMemo(
    () =>
      buildMonthlyProfitSeries(orders, itemSubtotalMap, itemQuantityMap, last6MonthsRange, PROFIT_STATUSES),
    [orders, itemSubtotalMap, itemQuantityMap, last6MonthsRange]
  )

  const statusRows = React.useMemo(() => {
    return DISPLAY_STATUSES.map((status) => ({
      status,
      label: statusLabel(status),
      count: statusCount30Days.get(status) ?? 0,
    }))
  }, [statusCount30Days])

  const maxStatusCount = React.useMemo(() => {
    return Math.max(1, ...statusRows.map((row) => row.count))
  }, [statusRows])

  const maxMonthlyNet = React.useMemo(() => {
    return Math.max(1, ...monthlyNetSeries.map((row) => row.net))
  }, [monthlyNetSeries])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orders (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{profit30Days.orderCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gross Profit (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatMoney(profit30Days.grossProfit)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Profit (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatMoney(profit30Days.netProfit)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Discounts (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatMoney(profit30Days.discountTotal)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Order Status Distribution (Last 30 Days)</CardTitle>
            <Button variant="outline" size="sm" onClick={loadOverview} disabled={loading}>
              <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : (
              <div className="space-y-3">
                {statusRows.map((row) => {
                  const width = (row.count / maxStatusCount) * 100
                  return (
                    <div key={row.status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor(row.status)}`} />
                          <span>{row.label}</span>
                        </div>
                        <span className="font-medium">{row.count}</span>
                      </div>
                      <div className="h-2 rounded bg-muted">
                        <div
                          className={`h-2 rounded ${statusColor(row.status)}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Net Profit (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : monthlyNetSeries.length === 0 ? (
              <div className="text-sm text-muted-foreground">No data available.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex h-52 items-end gap-2">
                  {monthlyNetSeries.map((row) => {
                    const height = (row.net / maxMonthlyNet) * 100
                    return (
                      <div key={row.monthKey} className="flex flex-1 flex-col items-center gap-2">
                        <div className="w-full rounded-t bg-emerald-500/80" style={{ height: `${height}%` }} />
                        <div className="text-center text-[11px] text-muted-foreground">{row.label}</div>
                      </div>
                    )
                  })}
                </div>

                <div className="grid gap-1 text-xs text-muted-foreground">
                  {monthlyNetSeries.map((row) => (
                    <div key={`${row.monthKey}-value`} className="flex items-center justify-between">
                      <span>{row.label}</span>
                      <span className="font-medium">{formatMoney(row.net)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
