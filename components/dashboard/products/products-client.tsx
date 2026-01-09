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
import { Textarea } from "@/components/ui/textarea"

type CategoryRow = {
  id: string
  name: string
  parent_id: string | null
}

type ProductRow = {
  id: string
  name: string
  description: string | null
  category_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type ProductWithCategory = ProductRow & {
  category_name: string | null
}

type ProductInsert = {
  name: string
  description?: string | null
  category_id?: string | null
  is_active?: boolean
}

type ProductUpdate = {
  name?: string
  description?: string | null
  category_id?: string | null
  is_active?: boolean
}

function labelCategory(cat: CategoryRow, byId: Map<string, CategoryRow>) {
  if (!cat.parent_id) return cat.name
  const parent = byId.get(cat.parent_id)
  return parent ? `${parent.name} / ${cat.name}` : cat.name
}

export default function ProductsClient() {
  const [products, setProducts] = React.useState<ProductWithCategory[]>([])
  const [categories, setCategories] = React.useState<CategoryRow[]>([])

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [q, setQ] = React.useState("")

  // form dialog
  const [openForm, setOpenForm] = React.useState(false)
  const [mode, setMode] = React.useState<"create" | "edit">("create")
  const [editing, setEditing] = React.useState<ProductWithCategory | null>(null)

  // form fields
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [categoryId, setCategoryId] = React.useState<string>("__none__")
  const [isActive, setIsActive] = React.useState(true)

  // delete confirm
  const [openDelete, setOpenDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState<ProductWithCategory | null>(null)

  async function loadAll() {
    setError(null)
    setLoading(true)

    const [{ data: cats, error: catsErr }, { data: prods, error: prodErr }] = await Promise.all([
      supabase.from("categories").select("id,name,parent_id").order("name", { ascending: true }),
      supabase
        .from("products")
        .select("id,name,description,category_id,is_active,created_at,updated_at")
        .order("created_at", { ascending: false }),
    ])

    setLoading(false)

    if (catsErr) {
      setError(catsErr.message)
      return
    }
    if (prodErr) {
      setError(prodErr.message)
      return
    }

    const catRows = (cats ?? []) as CategoryRow[]
    const byId = new Map(catRows.map((c) => [c.id, c]))

    setCategories(
      catRows
        .slice()
        .sort((a, b) => labelCategory(a, byId).localeCompare(labelCategory(b, byId)))
    )

    const mapped = ((prods ?? []) as ProductRow[]).map((p) => ({
      ...p,
      category_name: p.category_id ? byId.get(p.category_id)?.name ?? null : null,
    }))

    setProducts(mapped)
  }

  React.useEffect(() => {
    loadAll()
  }, [])

  function openCreate() {
    setMode("create")
    setEditing(null)
    setName("")
    setDescription("")
    setCategoryId("__none__")
    setIsActive(true)
    setError(null)
    setOpenForm(true)
  }

  function openEdit(row: ProductWithCategory) {
    setMode("edit")
    setEditing(row)
    setName(row.name ?? "")
    setDescription(row.description ?? "")
    setCategoryId(row.category_id ?? "__none__")
    setIsActive(!!row.is_active)
    setError(null)
    setOpenForm(true)
  }

  async function onSave() {
    setError(null)
    const cleanName = name.trim()
    const cleanDesc = description.trim()
    const cleanCategory = categoryId === "__none__" ? null : categoryId

    if (!cleanName) {
      setError("Product name is required.")
      return
    }

    setSaving(true)

    try {
      if (mode === "create") {
        const payload: ProductInsert = {
          name: cleanName,
          description: cleanDesc ? cleanDesc : null,
          category_id: cleanCategory,
          is_active: isActive,
        }

        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id,name,description,category_id,is_active,created_at,updated_at")
          .single()

        if (error) throw error

        // map category_name
        const byId = new Map(categories.map((c) => [c.id, c]))
        const newRow: ProductWithCategory = {
          ...(data as ProductRow),
          category_name: data?.category_id ? byId.get(data.category_id)?.name ?? null : null,
        }

        setProducts((prev) => [newRow, ...prev])
        setOpenForm(false)
        return
      }

      if (!editing?.id) throw new Error("No product selected.")

      const payload: ProductUpdate = {
        name: cleanName,
        description: cleanDesc ? cleanDesc : null,
        category_id: cleanCategory,
        is_active: isActive,
      }

      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", editing.id)
        .select("id,name,description,category_id,is_active,created_at,updated_at")
        .single()

      if (error) throw error

      const byId = new Map(categories.map((c) => [c.id, c]))
      const updated: ProductWithCategory = {
        ...(data as ProductRow),
        category_name: data?.category_id ? byId.get(data.category_id)?.name ?? null : null,
      }

      setProducts((prev) => prev.map((p) => (p.id === editing.id ? updated : p)))
      setOpenForm(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  function askDelete(row: ProductWithCategory) {
    setDeleting(row)
    setOpenDelete(true)
  }

  async function confirmDelete() {
    if (!deleting?.id) return
    setSaving(true)
    setError(null)

    const { error } = await supabase.from("products").delete().eq("id", deleting.id)

    setSaving(false)

    if (error) {
      // If product has variants, deletion is cascade (variants delete) — but might still fail if referenced elsewhere.
      // Common failure: FK from reviews/product_id (if exists) or order_items via variants etc.
      const msg = error.message.includes("violates foreign key constraint")
        ? "You can’t delete this product because it’s referenced by other data (e.g. reviews/orders)."
        : error.message
      setError(msg)
      setOpenDelete(false)
      return
    }

    setProducts((prev) => prev.filter((p) => p.id !== deleting.id))
    setOpenDelete(false)
    setDeleting(null)
  }

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return products
    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(s) ||
        (p.category_name ?? "").toLowerCase().includes(s)
      )
    })
  }, [products, q])

  // categories display labels with parent/child
  const categoriesForSelect = React.useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]))
    return categories
      .slice()
      .sort((a, b) => labelCategory(a, byId).localeCompare(labelCategory(b, byId)))
      .map((c) => ({ id: c.id, label: labelCategory(c, byId) }))
  }, [categories])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">All Products</CardTitle>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or category…"
              className="w-full sm:w-72"
            />

            <Button
              variant="outline"
              onClick={loadAll}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>

            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Product
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
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
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
                      No products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.category_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className={row.is_active ? "text-emerald-500" : "text-muted-foreground"}>
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
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

          <p className="mt-3 text-xs text-muted-foreground">
            Note: Product images are managed per variant (Variant Images page).
          </p>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-180">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add Product" : "Edit Product"}</DialogTitle>
            <DialogDescription>
              Create a product. You’ll add size/color variants and images in the Variants pages.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Classic Hoodie"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="p-desc">Description (optional)</Label>
              <Textarea
                id="p-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description…"
                rows={4}
              />
            </div>

            <div className="grid gap-2">
              <Label>Category (optional)</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No category</SelectItem>
                  {categoriesForSelect.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <div className="font-medium">Active</div>
                <div className="text-sm text-muted-foreground">
                  If inactive, the store won’t show this product to customers.
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
              {saving ? "Saving…" : mode === "create" ? "Create" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium">{deleting?.name}</span>. If it’s referenced by orders/reviews,
              deletion may be blocked.
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
