// components/dashboard/colors/colors-client.tsx
"use client"

import * as React from "react"
import { supabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react"

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ColorRow = {
  id: string
  name: string
  hex_code: string | null
}

function isValidHex(hex: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim())
}

export default function ColorsClient() {
  const [colors, setColors] = React.useState<ColorRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // search
  const [q, setQ] = React.useState("")

  // dialog state
  const [openForm, setOpenForm] = React.useState(false)
  const [mode, setMode] = React.useState<"create" | "edit">("create")
  const [editing, setEditing] = React.useState<ColorRow | null>(null)

  // form fields
  const [name, setName] = React.useState("")
  const [hex, setHex] = React.useState("")

  // delete confirm
  const [openDelete, setOpenDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState<ColorRow | null>(null)

  async function load() {
    setError(null)
    setLoading(true)

    const { data, error } = await supabase
      .from("colors")
      .select("id,name,hex_code")
      .order("name", { ascending: true })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setColors((data ?? []) as ColorRow[])
  }

  React.useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setMode("create")
    setEditing(null)
    setName("")
    setHex("")
    setError(null)
    setOpenForm(true)
  }

  function openEdit(row: ColorRow) {
    setMode("edit")
    setEditing(row)
    setName(row.name ?? "")
    setHex(row.hex_code ?? "")
    setError(null)
    setOpenForm(true)
  }

  async function onSave() {
    setError(null)

    const cleanName = name.trim()
    const cleanHex = hex.trim()

    if (!cleanName) {
      setError("Color name is required.")
      return
    }
    if (cleanHex && !isValidHex(cleanHex)) {
      setError("Hex code must be like #FFF or #FFFFFF.")
      return
    }

    setSaving(true)

    if (mode === "create") {
      const { data, error } = await supabase
        .from("colors")
        .insert({ name: cleanName, hex_code: cleanHex || null })
        .select("id,name,hex_code")
        .single()

      setSaving(false)

      if (error) {
        setError(error.message)
        return
      }

      setColors((prev) => {
        const next = [data as ColorRow, ...prev]
        next.sort((a, b) => a.name.localeCompare(b.name))
        return next
      })
      setOpenForm(false)
      return
    }

    // edit
    if (!editing?.id) {
      setSaving(false)
      setError("No color selected to edit.")
      return
    }

    const { data, error } = await supabase
      .from("colors")
      .update({ name: cleanName, hex_code: cleanHex || null })
      .eq("id", editing.id)
      .select("id,name,hex_code")
      .single()

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setColors((prev) => {
      const next = prev.map((c) => (c.id === editing.id ? (data as ColorRow) : c))
      next.sort((a, b) => a.name.localeCompare(b.name))
      return next
    })
    setOpenForm(false)
  }

  function askDelete(row: ColorRow) {
    setDeleting(row)
    setOpenDelete(true)
  }

  async function confirmDelete() {
    if (!deleting?.id) return
    setError(null)
    setSaving(true)

    const { error } = await supabase.from("colors").delete().eq("id", deleting.id)

    setSaving(false)

    if (error) {
      // If this color is referenced by product_variants.color_id you'll get a FK error
      setError(
        error.message.includes("violates foreign key constraint")
          ? "You can’t delete this color because it’s used by one or more variants."
          : error.message
      )
      setOpenDelete(false)
      return
    }

    setColors((prev) => prev.filter((c) => c.id !== deleting.id))
    setOpenDelete(false)
    setDeleting(null)
  }

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return colors
    return colors.filter((c) => {
      const n = (c.name ?? "").toLowerCase()
      const h = (c.hex_code ?? "").toLowerCase()
      return n.includes(s) || h.includes(s)
    })
  }, [colors, q])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">All Colors</CardTitle>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-auto">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or hex…"
                className="w-full sm:w-55"
              />
            </div>

            <Button
              variant="outline"
              onClick={load}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>

            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Color
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
                  <TableHead className="w-22.5">Preview</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Hex</TableHead>
                  <TableHead className="w-35 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No colors found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div
                          className="h-6 w-10 rounded border"
                          style={{
                            backgroundColor: row.hex_code || "transparent",
                          }}
                          title={row.hex_code ?? ""}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.hex_code ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(row)}
                            className="w-full sm:w-auto"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
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

          <p className="mt-3 text-xs text-muted-foreground">
            Tip: If delete fails, the color is probably referenced by a variant.
          </p>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-130">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add Color" : "Edit Color"}</DialogTitle>
            <DialogDescription>
              Add a color name and optional hex code.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="color-name">Name</Label>
              <Input
                id="color-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Black"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="color-hex">Hex code (optional)</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  id="color-hex"
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  placeholder="#000000"
                />
                <div
                  className="h-10 w-12 rounded border"
                  style={{
                    backgroundColor: isValidHex(hex) ? hex.trim() : "transparent",
                  }}
                  title={hex}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Valid formats: <span className="font-mono">#FFF</span> or{" "}
                <span className="font-mono">#FFFFFF</span>
              </p>
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpenForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : mode === "create" ? "Create" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete color?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium">{deleting?.name}</span>. If it’s used
              by variants, deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={saving}>
              {saving ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
