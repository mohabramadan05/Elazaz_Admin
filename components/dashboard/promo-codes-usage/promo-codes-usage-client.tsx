"use client"

import * as React from "react"
import { supabase } from "@/lib/supabase/client"
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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

const NO_PROMO_CODE = "__none__"
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PromoCodeOption = {
  id: string
  code: string
  is_active: boolean
  discount_percent: number
  max_uses_per_user: number
}

type PromoCodeUsageRow = {
  id: string
  promo_code_id: string
  user_id: string
  order_id: string
  used_at: string
}

type PromoCodeUsageView = PromoCodeUsageRow & {
  promo_code_text: string | null
}

type PromoCodeUsageInsert = {
  promo_code_id: string
  user_id: string
  order_id: string
  used_at: string
}

type PromoCodeUsageUpdate = {
  promo_code_id?: string
  user_id?: string
  order_id?: string
  used_at?: string
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const hours = pad2(date.getHours())
  const minutes = pad2(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function nowLocalDateTimeInput() {
  return toLocalDateTimeInput(new Date().toISOString())
}

function fromLocalDateTimeInput(value: string) {
  const clean = value.trim()
  if (!clean) return null
  const date = new Date(clean)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function isValidUuid(value: string) {
  return UUID_REGEX.test(value)
}

function sortByUsedAtDesc(rows: PromoCodeUsageView[]) {
  return rows
    .slice()
    .sort((a, b) => new Date(b.used_at).getTime() - new Date(a.used_at).getTime())
}

function toUsageView(row: PromoCodeUsageRow, promoCodeTextById: Map<string, string>) {
  return {
    ...row,
    promo_code_text: promoCodeTextById.get(row.promo_code_id) ?? null,
  }
}

export default function PromoCodesUsageClient() {
  const [promoCodes, setPromoCodes] = React.useState<PromoCodeOption[]>([])
  const [usages, setUsages] = React.useState<PromoCodeUsageView[]>([])

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [q, setQ] = React.useState("")

  const [openForm, setOpenForm] = React.useState(false)
  const [mode, setMode] = React.useState<"create" | "edit">("create")
  const [editing, setEditing] = React.useState<PromoCodeUsageView | null>(null)

  const [promoCodeId, setPromoCodeId] = React.useState(NO_PROMO_CODE)
  const [userId, setUserId] = React.useState("")
  const [orderId, setOrderId] = React.useState("")
  const [usedAt, setUsedAt] = React.useState("")

  const [openDelete, setOpenDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState<PromoCodeUsageView | null>(null)

  async function loadAll() {
    setError(null)
    setLoading(true)

    const [{ data: promoData, error: promoError }, { data: usageData, error: usageError }] =
      await Promise.all([
        supabase
          .from("promo_codes")
          .select("id,code,is_active,discount_percent,max_uses_per_user")
          .order("code", { ascending: true }),
        supabase
          .from("promo_code_usages")
          .select("id,promo_code_id,user_id,order_id,used_at")
          .order("used_at", { ascending: false }),
      ])

    setLoading(false)

    if (promoError) {
      setError(promoError.message)
      return
    }

    if (usageError) {
      setError(usageError.message)
      return
    }

    const promoRows = (promoData ?? []) as PromoCodeOption[]
    const usageRows = (usageData ?? []) as PromoCodeUsageRow[]
    const promoCodeTextById = new Map(promoRows.map((row) => [row.id, row.code]))

    setPromoCodes(promoRows)
    setUsages(usageRows.map((row) => toUsageView(row, promoCodeTextById)))
  }

  React.useEffect(() => {
    loadAll()
  }, [])

  function openCreate() {
    setMode("create")
    setEditing(null)
    setPromoCodeId(promoCodes[0]?.id ?? NO_PROMO_CODE)
    setUserId("")
    setOrderId("")
    setUsedAt(nowLocalDateTimeInput())
    setError(null)
    setOpenForm(true)
  }

  function openEdit(row: PromoCodeUsageView) {
    setMode("edit")
    setEditing(row)
    setPromoCodeId(row.promo_code_id)
    setUserId(row.user_id)
    setOrderId(row.order_id)
    setUsedAt(toLocalDateTimeInput(row.used_at))
    setError(null)
    setOpenForm(true)
  }

  async function onSave() {
    setError(null)

    if (promoCodeId === NO_PROMO_CODE) {
      setError("Promo code is required.")
      return
    }

    const cleanUserId = userId.trim()
    if (!isValidUuid(cleanUserId)) {
      setError("User ID must be a valid UUID.")
      return
    }

    const cleanOrderId = orderId.trim()
    if (!isValidUuid(cleanOrderId)) {
      setError("Order ID must be a valid UUID.")
      return
    }

    const usedAtIso = fromLocalDateTimeInput(usedAt)
    if (!usedAtIso) {
      setError("Used at must be a valid date/time.")
      return
    }

    const promoCodeTextById = new Map(promoCodes.map((row) => [row.id, row.code]))

    setSaving(true)

    try {
      if (mode === "create") {
        const payload: PromoCodeUsageInsert = {
          promo_code_id: promoCodeId,
          user_id: cleanUserId,
          order_id: cleanOrderId,
          used_at: usedAtIso,
        }

        const { data, error } = await supabase
          .from("promo_code_usages")
          .insert(payload)
          .select("id,promo_code_id,user_id,order_id,used_at")
          .single()

        if (error) throw error

        const inserted = toUsageView(data as PromoCodeUsageRow, promoCodeTextById)
        setUsages((prev) => sortByUsedAtDesc([inserted, ...prev]))
        setOpenForm(false)
        return
      }

      if (!editing?.id) throw new Error("No usage record selected.")

      const payload: PromoCodeUsageUpdate = {
        promo_code_id: promoCodeId,
        user_id: cleanUserId,
        order_id: cleanOrderId,
        used_at: usedAtIso,
      }

      const { data, error } = await supabase
        .from("promo_code_usages")
        .update(payload)
        .eq("id", editing.id)
        .select("id,promo_code_id,user_id,order_id,used_at")
        .single()

      if (error) throw error

      const updated = toUsageView(data as PromoCodeUsageRow, promoCodeTextById)
      setUsages((prev) => sortByUsedAtDesc(prev.map((row) => (row.id === editing.id ? updated : row))))
      setOpenForm(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  function askDelete(row: PromoCodeUsageView) {
    setDeleting(row)
    setOpenDelete(true)
  }

  async function confirmDelete() {
    if (!deleting?.id) return

    setSaving(true)
    setError(null)

    const { error } = await supabase.from("promo_code_usages").delete().eq("id", deleting.id)

    setSaving(false)

    if (error) {
      setError(error.message)
      setOpenDelete(false)
      return
    }

    setUsages((prev) => prev.filter((row) => row.id !== deleting.id))
    setDeleting(null)
    setOpenDelete(false)
  }

  const filtered = React.useMemo(() => {
    const search = q.trim().toLowerCase()
    if (!search) return usages

    return usages.filter((row) => {
      return (
        (row.promo_code_text ?? "").toLowerCase().includes(search) ||
        row.user_id.toLowerCase().includes(search) ||
        row.order_id.toLowerCase().includes(search)
      )
    })
  }, [usages, q])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Promo Code Usage Records</CardTitle>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by promo code, user, or order..."
            className="w-full sm:w-72"
          />

          <Button variant="outline" onClick={loadAll} disabled={loading} className="w-full sm:w-auto">
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>

          <Button onClick={openCreate} className="w-full sm:w-auto" disabled={promoCodes.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Add Usage
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {promoCodes.length === 0 ? (
          <div className="mb-4 rounded-md border px-3 py-2 text-sm text-muted-foreground">
            No promo codes found. Create at least one promo code before adding usage records.
          </div>
        ) : null}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Promo Code</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Used At</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No usage records found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.promo_code_text ?? "(missing code)"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.user_id}</TableCell>
                    <TableCell className="font-mono text-xs">{row.order_id}</TableCell>
                    <TableCell>{formatDateTime(row.used_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(row)}
                          className="w-full sm:w-auto"
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => askDelete(row)}
                          className="w-full sm:w-auto"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add Usage Record" : "Edit Usage Record"}</DialogTitle>
            <DialogDescription>
              Link a promo code usage to a user and order with an exact usage timestamp.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Promo Code</Label>
              <Select value={promoCodeId} onValueChange={setPromoCodeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select promo code" />
                </SelectTrigger>
                <SelectContent>
                  {promoCodes.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.code} ({row.discount_percent}% / {row.max_uses_per_user} per user /{" "}
                      {row.is_active ? "active" : "inactive"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="usage-user-id">User ID (UUID)</Label>
              <Input
                id="usage-user-id"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="usage-order-id">Order ID (UUID)</Label>
              <Input
                id="usage-order-id"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="used-at">Used At</Label>
              <Input
                id="used-at"
                type="datetime-local"
                value={usedAt}
                onChange={(e) => setUsedAt(e.target.value)}
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : mode === "create" ? "Create" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete usage record?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the usage entry for{" "}
              <span className="font-medium">{deleting?.promo_code_text ?? "(missing code)"}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
