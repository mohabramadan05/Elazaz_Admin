"use client"

import * as React from "react"
import { supabase } from "@/lib/supabase/client"
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type PromoCodeRow = {
  id: string
  code: string
  discount_percent: number
  expires_at: string | null
  is_active: boolean
  max_uses_per_user: number
  created_at: string
  updated_at: string
}

type PromoCodeInsert = {
  code: string
  discount_percent: number
  expires_at: string | null
  is_active: boolean
  max_uses_per_user: number
}

type PromoCodeUpdate = {
  code?: string
  discount_percent?: number
  expires_at?: string | null
  is_active?: boolean
  max_uses_per_user?: number
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function toLocalDateTimeInput(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const hours = pad2(date.getHours())
  const minutes = pad2(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function fromLocalDateTimeInput(value: string) {
  const clean = value.trim()
  if (!clean) return null

  const date = new Date(clean)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function formatDateTime(value: string | null) {
  if (!value) return "No expiry"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function sortByCreatedAtDesc(rows: PromoCodeRow[]) {
  return rows
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

function mapDbError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes("duplicate key") || lower.includes("promo_codes_code_key")) {
    return "Promo code already exists. Use a unique code."
  }
  return message
}

export default function PromoCodesClient() {
  const [promoCodes, setPromoCodes] = React.useState<PromoCodeRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [q, setQ] = React.useState("")

  const [openForm, setOpenForm] = React.useState(false)
  const [mode, setMode] = React.useState<"create" | "edit">("create")
  const [editing, setEditing] = React.useState<PromoCodeRow | null>(null)

  const [code, setCode] = React.useState("")
  const [discountPercent, setDiscountPercent] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [isActive, setIsActive] = React.useState(true)
  const [maxUsesPerUser, setMaxUsesPerUser] = React.useState("")

  const [openDelete, setOpenDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState<PromoCodeRow | null>(null)

  async function load() {
    setError(null)
    setLoading(true)

    const { data, error } = await supabase
      .from("promo_codes")
      .select("id,code,discount_percent,expires_at,is_active,max_uses_per_user,created_at,updated_at")
      .order("created_at", { ascending: false })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setPromoCodes((data ?? []) as PromoCodeRow[])
  }

  React.useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setMode("create")
    setEditing(null)
    setCode("")
    setDiscountPercent("")
    setExpiresAt("")
    setIsActive(true)
    setMaxUsesPerUser("1")
    setError(null)
    setOpenForm(true)
  }

  function openEdit(row: PromoCodeRow) {
    setMode("edit")
    setEditing(row)
    setCode(row.code)
    setDiscountPercent(String(row.discount_percent))
    setExpiresAt(toLocalDateTimeInput(row.expires_at))
    setIsActive(!!row.is_active)
    setMaxUsesPerUser(String(row.max_uses_per_user))
    setError(null)
    setOpenForm(true)
  }

  async function onSave() {
    setError(null)

    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) {
      setError("Promo code is required.")
      return
    }

    const parsedDiscount = Number(discountPercent)
    if (!Number.isInteger(parsedDiscount) || parsedDiscount < 1 || parsedDiscount > 100) {
      setError("Discount percent must be an integer between 1 and 100.")
      return
    }

    const parsedMaxUses = Number(maxUsesPerUser)
    if (!Number.isInteger(parsedMaxUses) || parsedMaxUses < 1) {
      setError("Max uses per user must be an integer of at least 1.")
      return
    }

    const expiresAtIso = fromLocalDateTimeInput(expiresAt)
    if (expiresAt.trim() && !expiresAtIso) {
      setError("Expires at must be a valid date/time.")
      return
    }

    setSaving(true)

    try {
      if (mode === "create") {
        const payload: PromoCodeInsert = {
          code: cleanCode,
          discount_percent: parsedDiscount,
          expires_at: expiresAtIso,
          is_active: isActive,
          max_uses_per_user: parsedMaxUses,
        }

        const { data, error } = await supabase
          .from("promo_codes")
          .insert(payload)
          .select("id,code,discount_percent,expires_at,is_active,max_uses_per_user,created_at,updated_at")
          .single()

        if (error) throw error

        const row = data as PromoCodeRow
        setPromoCodes((prev) => sortByCreatedAtDesc([row, ...prev]))
        setOpenForm(false)
        return
      }

      if (!editing?.id) throw new Error("No promo code selected.")

      const payload: PromoCodeUpdate = {
        code: cleanCode,
        discount_percent: parsedDiscount,
        expires_at: expiresAtIso,
        is_active: isActive,
        max_uses_per_user: parsedMaxUses,
      }

      const { data, error } = await supabase
        .from("promo_codes")
        .update(payload)
        .eq("id", editing.id)
        .select("id,code,discount_percent,expires_at,is_active,max_uses_per_user,created_at,updated_at")
        .single()

      if (error) throw error

      const row = data as PromoCodeRow
      setPromoCodes((prev) =>
        sortByCreatedAtDesc(prev.map((item) => (item.id === editing.id ? row : item)))
      )
      setOpenForm(false)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong."
      setError(mapDbError(message))
    } finally {
      setSaving(false)
    }
  }

  function askDelete(row: PromoCodeRow) {
    setDeleting(row)
    setOpenDelete(true)
  }

  async function confirmDelete() {
    if (!deleting?.id) return

    setSaving(true)
    setError(null)

    const { error } = await supabase.from("promo_codes").delete().eq("id", deleting.id)

    setSaving(false)

    if (error) {
      const lower = error.message.toLowerCase()
      const message = lower.includes("violates foreign key constraint")
        ? "You cannot delete this promo code because usage records are linked to it."
        : mapDbError(error.message)
      setError(message)
      setOpenDelete(false)
      return
    }

    setPromoCodes((prev) => prev.filter((row) => row.id !== deleting.id))
    setDeleting(null)
    setOpenDelete(false)
  }

  const filtered = React.useMemo(() => {
    const search = q.trim().toLowerCase()
    if (!search) return promoCodes

    return promoCodes.filter((row) => {
      return (
        row.code.toLowerCase().includes(search) ||
        String(row.discount_percent).includes(search) ||
        String(row.max_uses_per_user).includes(search)
      )
    })
  }, [promoCodes, q])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">All Promo Codes</CardTitle>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, discount, or max usage..."
            className="w-full sm:w-72"
          />

          <Button variant="outline" onClick={load} disabled={loading} className="w-full sm:w-auto">
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>

          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Promo Code
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Max/User</TableHead>
                <TableHead>Expires At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated At</TableHead>
                <TableHead className="w-44 text-right">Actions</TableHead>
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
                    No promo codes found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.code}</TableCell>
                    <TableCell>{row.discount_percent}%</TableCell>
                    <TableCell>{row.max_uses_per_user}</TableCell>
                    <TableCell>{formatDateTime(row.expires_at)}</TableCell>
                    <TableCell>
                      <span className={row.is_active ? "text-emerald-500" : "text-muted-foreground"}>
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>{formatDateTime(row.updated_at)}</TableCell>
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
            <DialogTitle>{mode === "create" ? "Add Promo Code" : "Edit Promo Code"}</DialogTitle>
            <DialogDescription>
              Configure code, percentage discount, activity status, expiry, and per-user usage limit.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="promo-code">Code</Label>
              <Input
                id="promo-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SAVE20"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="discount-percent">Discount Percent</Label>
                <Input
                  id="discount-percent"
                  type="number"
                  min={1}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="e.g. 20"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="max-uses">Max Uses Per User</Label>
                <Input
                  id="max-uses"
                  type="number"
                  min={1}
                  value={maxUsesPerUser}
                  onChange={(e) => setMaxUsesPerUser(e.target.value)}
                  placeholder="e.g. 1"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="expires-at">Expires At (optional)</Label>
              <Input
                id="expires-at"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <div className="font-medium">Active</div>
                <div className="text-sm text-muted-foreground">
                  If inactive, customers cannot apply this promo code.
                </div>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
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
            <AlertDialogTitle>Delete promo code?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <span className="font-medium">{deleting?.code}</span>. If usage
              records exist, deletion will be blocked.
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
