"use client"

import * as React from "react"
import { supabase } from "@/lib/supabase/client"
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

type SizeRow = {
  id: string
  name: string
}

export default function SizesClient() {
  const [sizes, setSizes] = React.useState<SizeRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // search
  const [q, setQ] = React.useState("")

  // dialog state
  const [openForm, setOpenForm] = React.useState(false)
  const [mode, setMode] = React.useState<"create" | "edit">("create")
  const [editing, setEditing] = React.useState<SizeRow | null>(null)

  // form
  const [name, setName] = React.useState("")

  // delete confirm
  const [openDelete, setOpenDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState<SizeRow | null>(null)

  async function load() {
    setError(null)
    setLoading(true)

    const { data, error } = await supabase
      .from("sizes")
      .select("id,name")
      .order("name", { ascending: true })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSizes((data ?? []) as SizeRow[])
  }

  React.useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setMode("create")
    setEditing(null)
    setName("")
    setError(null)
    setOpenForm(true)
  }

  function openEdit(row: SizeRow) {
    setMode("edit")
    setEditing(row)
    setName(row.name)
    setError(null)
    setOpenForm(true)
  }

  async function onSave() {
    setError(null)

    const cleanName = name.trim()
    if (!cleanName) {
      setError("Size name is required.")
      return
    }

    setSaving(true)

    if (mode === "create") {
      const { data, error } = await supabase
        .from("sizes")
        .insert({ name: cleanName })
        .select("id,name")
        .single()

      setSaving(false)

      if (error) {
        setError(error.message)
        return
      }

      setSizes((prev) =>
        [...prev, data as SizeRow].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      )
      setOpenForm(false)
      return
    }

    if (!editing?.id) {
      setSaving(false)
      setError("No size selected.")
      return
    }

    const { data, error } = await supabase
      .from("sizes")
      .update({ name: cleanName })
      .eq("id", editing.id)
      .select("id,name")
      .single()

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setSizes((prev) =>
      prev
        .map((s) => (s.id === editing.id ? (data as SizeRow) : s))
        .sort((a, b) => a.name.localeCompare(b.name))
    )
    setOpenForm(false)
  }

  function askDelete(row: SizeRow) {
    setDeleting(row)
    setOpenDelete(true)
  }

  async function confirmDelete() {
    if (!deleting?.id) return

    setSaving(true)
    setError(null)

    const { error } = await supabase.from("sizes").delete().eq("id", deleting.id)

    setSaving(false)

    if (error) {
      setError(
        error.message.includes("violates foreign key constraint")
          ? "You can’t delete this size because it’s used by one or more variants."
          : error.message
      )
      setOpenDelete(false)
      return
    }

    setSizes((prev) => prev.filter((s) => s.id !== deleting.id))
    setDeleting(null)
    setOpenDelete(false)
  }

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return sizes
    return sizes.filter((size) =>
      size.name.toLowerCase().includes(s)
    )
  }, [sizes, q])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">All Sizes</CardTitle>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sizes…"
            className="w-full sm:w-50"
          />

          <Button
            variant="outline"
            onClick={load}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>

          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Size
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-35 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={2} className="py-10 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="py-10 text-center text-sm text-muted-foreground">
                    No sizes found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
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

      {/* Create / Edit dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-105">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add Size" : "Edit Size"}</DialogTitle>
            <DialogDescription>
              Enter a size label (e.g. S, M, L, XL).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="size-name">Name</Label>
            <Input
              id="size-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. XL"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
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
            <AlertDialogTitle>Delete size?</AlertDialogTitle>
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
    </Card>
  )
}
