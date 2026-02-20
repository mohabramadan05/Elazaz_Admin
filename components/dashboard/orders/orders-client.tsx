"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Eye, RefreshCw } from "lucide-react"

import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

const ORDER_STATUSES = ["unpaid", "paid", "failed", "preparing", "done", "cancelled"] as const
const FAILED_LEGACY_ALIAS = "faield"
const UNKNOWN_STATUS = "__unknown__"

type OrderStatus = (typeof ORDER_STATUSES)[number]

type OrderRow = {
  id: string
  user_id: string
  address_id: string | null
  shipping_address: unknown | null
  status: string
  total_amount: number | string | null
  promo_code_id: string | null
  discount_amount: number | string | null
  created_at: string
  updated_at: string
  transaction_id: string | null
  transaction: unknown | null
  first_name: string | null
  second_name: string | null
  comany_name: string | null
  email: string | null
  paymob_order_id: string | null
}

type OrderItemRow = {
  id: string
  order_id: string
  variant_id: string
  price: number | string
  quantity: number
  created_at: string
}

type OrderView = OrderRow & {
  items: OrderItemRow[]
  item_lines: number
  total_quantity: number
}

function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus)
}

function normalizeStatus(value: string | null | undefined) {
  const clean = value?.trim().toLowerCase()
  if (!clean) return null
  if (clean === FAILED_LEGACY_ALIAS) return "failed" as const
  return isOrderStatus(clean) ? clean : null
}

function statusLabel(value: string | null | undefined) {
  const normalized = normalizeStatus(value)
  if (!normalized) return value?.trim() || "Unknown"
  if (normalized === "unpaid") return "Unpaid"
  if (normalized === "paid") return "Paid"
  if (normalized === "failed") return "Failed"
  if (normalized === "preparing") return "Preparing"
  if (normalized === "done") return "Done"
  return "Cancelled"
}

function statusColorClass(value: string | null | undefined) {
  const normalized = normalizeStatus(value)
  if (normalized === "unpaid") return "bg-amber-500/15 text-amber-700"
  if (normalized === "paid") return "bg-emerald-500/15 text-emerald-700"
  if (normalized === "failed") return "bg-rose-500/15 text-rose-700"
  if (normalized === "preparing") return "bg-blue-500/15 text-blue-700"
  if (normalized === "done") return "bg-violet-500/15 text-violet-700"
  if (normalized === "cancelled") return "bg-muted text-muted-foreground"
  return "bg-muted text-muted-foreground"
}

function toNumber(value: number | string | null | undefined) {
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

function formatMoney(value: number | string | null | undefined) {
  return toNumber(value).toFixed(2)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function safeStringify(value: unknown) {
  if (value == null) return "-"
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function OrdersClient() {
  const searchParams = useSearchParams()
  const rawStatus = searchParams.get("status")
  const activeStatus = React.useMemo(() => normalizeStatus(rawStatus), [rawStatus])

  const [orders, setOrders] = React.useState<OrderView[]>([])
  const [loading, setLoading] = React.useState(true)
  const [savingOrderId, setSavingOrderId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState("")

  const [openDetails, setOpenDetails] = React.useState(false)
  const [selectedOrder, setSelectedOrder] = React.useState<OrderView | null>(null)

  const loadOrders = React.useCallback(async (statusFilter: OrderStatus | null) => {
    setError(null)
    setLoading(true)

    let query = supabase
      .from("orders")
      .select(
        "id,user_id,address_id,shipping_address,status,total_amount,promo_code_id,discount_amount,created_at,updated_at,transaction_id,transaction,first_name,second_name,comany_name,email,paymob_order_id"
      )
      .order("created_at", { ascending: false })

    if (statusFilter === "failed") {
      query = query.in("status", ["failed", FAILED_LEGACY_ALIAS])
    } else if (statusFilter) {
      query = query.eq("status", statusFilter)
    }

    const { data: ordersData, error: ordersError } = await query

    if (ordersError) {
      setLoading(false)
      setError(ordersError.message)
      return
    }

    const orderRows = (ordersData ?? []) as OrderRow[]
    if (orderRows.length === 0) {
      setOrders([])
      setLoading(false)
      return
    }

    const orderIds = orderRows.map((row) => row.id)
    const { data: itemsData, error: itemsError } = await supabase
      .from("order_items")
      .select("id,order_id,variant_id,price,quantity,created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true })

    setLoading(false)

    if (itemsError) {
      setError(itemsError.message)
      return
    }

    const itemsRows = (itemsData ?? []) as OrderItemRow[]
    const itemsByOrder = new Map<string, OrderItemRow[]>()
    for (const item of itemsRows) {
      const current = itemsByOrder.get(item.order_id) ?? []
      current.push(item)
      itemsByOrder.set(item.order_id, current)
    }

    const view: OrderView[] = orderRows.map((row) => {
      const rowItems = itemsByOrder.get(row.id) ?? []
      const totalQuantity = rowItems.reduce(
        (sum, item) => sum + (Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0),
        0
      )

      return {
        ...row,
        items: rowItems,
        item_lines: rowItems.length,
        total_quantity: totalQuantity,
      }
    })

    setOrders(view)
  }, [])

  React.useEffect(() => {
    loadOrders(activeStatus)
  }, [activeStatus, loadOrders])

  async function onStatusChange(order: OrderView, nextStatus: OrderStatus) {
    const current = normalizeStatus(order.status)
    if (current === nextStatus) return

    setError(null)
    setSavingOrderId(order.id)

    let updateStatus: string = nextStatus
    let { error: updateError } = await supabase
      .from("orders")
      .update({ status: updateStatus })
      .eq("id", order.id)

    if (updateError && nextStatus === "failed") {
      updateStatus = FAILED_LEGACY_ALIAS
      const retry = await supabase.from("orders").update({ status: updateStatus }).eq("id", order.id)
      updateError = retry.error
    }

    if (updateError) {
      setSavingOrderId(null)
      setError(updateError.message)
      return
    }

    await loadOrders(activeStatus)
    setSavingOrderId(null)
  }

  function openOrderDetails(order: OrderView) {
    setSelectedOrder(order)
    setOpenDetails(true)
  }

  const filtered = React.useMemo(() => {
    const search = q.trim().toLowerCase()
    if (!search) return orders

    return orders.filter((row) => {
      const fullName = `${row.first_name ?? ""} ${row.second_name ?? ""}`.trim()
      return (
        row.id.toLowerCase().includes(search) ||
        row.user_id.toLowerCase().includes(search) ||
        fullName.toLowerCase().includes(search) ||
        (row.email ?? "").toLowerCase().includes(search) ||
        (row.transaction_id ?? "").toLowerCase().includes(search) ||
        (row.paymob_order_id ?? "").toLowerCase().includes(search) ||
        (row.status ?? "").toLowerCase().includes(search)
      )
    })
  }, [orders, q])

  const filterLinks: Array<{ label: string; href: string; key: string }> = [
    { label: "All", href: "/dashboard/orders", key: "all" },
    { label: "Unpaid", href: "/dashboard/orders?status=unpaid", key: "unpaid" },
    { label: "Paid", href: "/dashboard/orders?status=paid", key: "paid" },
    { label: "Failed", href: "/dashboard/orders?status=failed", key: "failed" },
    { label: "Preparing", href: "/dashboard/orders?status=preparing", key: "preparing" },
    { label: "Done", href: "/dashboard/orders?status=done", key: "done" },
    { label: "Cancelled", href: "/dashboard/orders?status=cancelled", key: "cancelled" },
  ]

  const activeKey = activeStatus ?? "all"

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">
              Orders {activeStatus ? `- ${statusLabel(activeStatus)}` : ""}
            </CardTitle>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search order, user, customer, email..."
                className="w-full sm:w-80"
              />

              <Button
                variant="outline"
                onClick={() => loadOrders(activeStatus)}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {filterLinks.map((link) => {
              const isActive = activeKey === link.key
              return (
                <Button key={link.key} variant={isActive ? "default" : "outline"} size="sm" asChild>
                  <a href={link.href}>{link.label}</a>
                </Button>
              )
            })}
          </div>
        </CardHeader>

        <CardContent>
          {rawStatus && !activeStatus ? (
            <div className="mb-4 rounded-md border px-3 py-2 text-sm text-muted-foreground">
              Unknown status filter <span className="font-mono">{rawStatus}</span>. Showing all orders.
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Totals</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => {
                    const normalized = normalizeStatus(row.status)
                    const selectValue = normalized ?? UNKNOWN_STATUS
                    const name = `${row.first_name ?? ""} ${row.second_name ?? ""}`.trim() || "-"
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-mono text-xs">{row.id}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Paymob: {row.paymob_order_id ?? "-"}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium">{name}</div>
                          <div className="text-xs text-muted-foreground">{row.email ?? "-"}</div>
                        </TableCell>

                        <TableCell className="space-y-2">
                          <span
                            className={`inline-flex rounded px-2 py-1 text-xs font-medium ${statusColorClass(row.status)}`}
                          >
                            {statusLabel(row.status)}
                          </span>

                          <Select
                            value={selectValue}
                            onValueChange={(value) => {
                              if (!isOrderStatus(value)) return
                              onStatusChange(row, value)
                            }}
                            disabled={savingOrderId === row.id}
                          >
                            <SelectTrigger className="h-8 w-40">
                              <SelectValue placeholder="Set status" />
                            </SelectTrigger>
                            <SelectContent>
                              {normalized ? null : (
                                <SelectItem value={UNKNOWN_STATUS} disabled>
                                  {row.status || "Unknown"}
                                </SelectItem>
                              )}
                              {ORDER_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {statusLabel(status)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell>
                          <div>{row.total_quantity} qty</div>
                          <div className="text-xs text-muted-foreground">{row.item_lines} lines</div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium">{formatMoney(row.total_amount)}</div>
                          <div className="text-xs text-muted-foreground">
                            Discount: {formatMoney(row.discount_amount)}
                          </div>
                        </TableCell>

                        <TableCell>{formatDateTime(row.created_at)}</TableCell>

                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openOrderDetails(row)}
                            className="w-full sm:w-auto"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={openDetails} onOpenChange={setOpenDetails}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              {selectedOrder ? `Order ${selectedOrder.id}` : "Order information"}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder ? (
            <div className="grid gap-4">
              <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="font-medium">{statusLabel(selectedOrder.status)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Created At</div>
                  <div>{formatDateTime(selectedOrder.created_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Updated At</div>
                  <div>{formatDateTime(selectedOrder.updated_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total Amount</div>
                  <div>{formatMoney(selectedOrder.total_amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Discount Amount</div>
                  <div>{formatMoney(selectedOrder.discount_amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Promo Code ID</div>
                  <div className="font-mono text-xs">{selectedOrder.promo_code_id ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">User ID</div>
                  <div className="font-mono text-xs">{selectedOrder.user_id}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Address ID</div>
                  <div className="font-mono text-xs">{selectedOrder.address_id ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Customer</div>
                  <div>
                    {`${selectedOrder.first_name ?? ""} ${selectedOrder.second_name ?? ""}`.trim() || "-"}
                  </div>
                  <div className="text-xs text-muted-foreground">{selectedOrder.email ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Company Name</div>
                  <div>{selectedOrder.comany_name ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Transaction ID</div>
                  <div className="font-mono text-xs">{selectedOrder.transaction_id ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Paymob Order ID</div>
                  <div className="font-mono text-xs">{selectedOrder.paymob_order_id ?? "-"}</div>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item ID</TableHead>
                      <TableHead>Variant ID</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                          No order items found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedOrder.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{item.id}</TableCell>
                          <TableCell className="font-mono text-xs">{item.variant_id}</TableCell>
                          <TableCell>{formatMoney(item.price)}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{(toNumber(item.price) * toNumber(item.quantity)).toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Shipping Address (JSON)</div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs">
                    {safeStringify(selectedOrder.shipping_address)}
                  </pre>
                </div>

                <div className="rounded-md border p-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Transaction (JSON)</div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs">
                    {safeStringify(selectedOrder.transaction)}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
