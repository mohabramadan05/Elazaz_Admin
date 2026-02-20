"use client"

import * as React from "react"
import { supabase } from "@/lib/supabase/client"
import { Plus, Pencil, Trash2, RefreshCw, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

const NO_PRODUCT = "__none__"
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ProductOption = {
  id: string
  name: string
}

type ReviewRow = {
  id: string
  product_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
}

type ReviewView = ReviewRow & {
  product_name: string | null
}

type ReviewInsert = {
  product_id: string
  user_id: string
  rating: number
  comment: string | null
}

type ReviewUpdate = {
  product_id?: string
  user_id?: string
  rating?: number
  comment?: string | null
}

function isValidUuid(value: string) {
  return UUID_REGEX.test(value)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function sortByCreatedAtDesc(rows: ReviewView[]) {
  return rows
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

function mapDbError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes("violates foreign key constraint")) {
    return "Invalid product or user reference. Check product_id/user_id."
  }
  return message
}

function starsLabel(rating: number) {
  const clamped = Math.max(1, Math.min(5, Math.round(rating)))
  return `${clamped} of 5`
}

export default function ReviewsClient() {
  const [products, setProducts] = React.useState<ProductOption[]>([])
  const [reviews, setReviews] = React.useState<ReviewView[]>([])

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [q, setQ] = React.useState("")

  const [openForm, setOpenForm] = React.useState(false)
  const [mode, setMode] = React.useState<"create" | "edit">("create")
  const [editing, setEditing] = React.useState<ReviewView | null>(null)

  const [productId, setProductId] = React.useState(NO_PRODUCT)
  const [userId, setUserId] = React.useState("")
  const [rating, setRating] = React.useState("5")
  const [comment, setComment] = React.useState("")

  const [openDelete, setOpenDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState<ReviewView | null>(null)

  async function loadAll() {
    setError(null)
    setLoading(true)

    const [{ data: productData, error: productError }, { data: reviewData, error: reviewError }] =
      await Promise.all([
        supabase.from("products").select("id,name").order("name", { ascending: true }),
        supabase
          .from("reviews")
          .select("id,product_id,user_id,rating,comment,created_at")
          .order("created_at", { ascending: false }),
      ])

    setLoading(false)

    if (productError) {
      setError(productError.message)
      return
    }
    if (reviewError) {
      setError(reviewError.message)
      return
    }

    const productRows = (productData ?? []) as ProductOption[]
    const reviewRows = (reviewData ?? []) as ReviewRow[]
    const productNameById = new Map(productRows.map((row) => [row.id, row.name]))

    setProducts(productRows)
    setReviews(
      reviewRows.map((row) => ({
        ...row,
        product_name: productNameById.get(row.product_id) ?? null,
      }))
    )
  }

  React.useEffect(() => {
    loadAll()
  }, [])

  function openCreate() {
    setMode("create")
    setEditing(null)
    setProductId(products[0]?.id ?? NO_PRODUCT)
    setUserId("")
    setRating("5")
    setComment("")
    setError(null)
    setOpenForm(true)
  }

  function openEdit(row: ReviewView) {
    setMode("edit")
    setEditing(row)
    setProductId(row.product_id)
    setUserId(row.user_id)
    setRating(String(row.rating))
    setComment(row.comment ?? "")
    setError(null)
    setOpenForm(true)
  }

  async function onSave() {
    setError(null)

    if (productId === NO_PRODUCT) {
      setError("Product is required.")
      return
    }

    const cleanUserId = userId.trim()
    if (!isValidUuid(cleanUserId)) {
      setError("User ID must be a valid UUID.")
      return
    }

    const parsedRating = Number(rating)
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      setError("Rating must be an integer between 1 and 5.")
      return
    }

    const cleanComment = comment.trim()
    const commentValue = cleanComment ? cleanComment : null

    const productNameById = new Map(products.map((row) => [row.id, row.name]))

    setSaving(true)

    try {
      if (mode === "create") {
        const payload: ReviewInsert = {
          product_id: productId,
          user_id: cleanUserId,
          rating: parsedRating,
          comment: commentValue,
        }

        const { data, error } = await supabase
          .from("reviews")
          .insert(payload)
          .select("id,product_id,user_id,rating,comment,created_at")
          .single()

        if (error) throw error

        const inserted = data as ReviewRow
        const insertedView: ReviewView = {
          ...inserted,
          product_name: productNameById.get(inserted.product_id) ?? null,
        }

        setReviews((prev) => sortByCreatedAtDesc([insertedView, ...prev]))
        setOpenForm(false)
        return
      }

      if (!editing?.id) throw new Error("No review selected.")

      const payload: ReviewUpdate = {
        product_id: productId,
        user_id: cleanUserId,
        rating: parsedRating,
        comment: commentValue,
      }

      const { data, error } = await supabase
        .from("reviews")
        .update(payload)
        .eq("id", editing.id)
        .select("id,product_id,user_id,rating,comment,created_at")
        .single()

      if (error) throw error

      const updated = data as ReviewRow
      const updatedView: ReviewView = {
        ...updated,
        product_name: productNameById.get(updated.product_id) ?? null,
      }

      setReviews((prev) => prev.map((row) => (row.id === editing.id ? updatedView : row)))
      setOpenForm(false)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong."
      setError(mapDbError(message))
    } finally {
      setSaving(false)
    }
  }

  function askDelete(row: ReviewView) {
    setDeleting(row)
    setOpenDelete(true)
  }

  async function confirmDelete() {
    if (!deleting?.id) return

    setSaving(true)
    setError(null)

    const { error } = await supabase.from("reviews").delete().eq("id", deleting.id)

    setSaving(false)

    if (error) {
      setError(mapDbError(error.message))
      setOpenDelete(false)
      return
    }

    setReviews((prev) => prev.filter((row) => row.id !== deleting.id))
    setDeleting(null)
    setOpenDelete(false)
  }

  const filtered = React.useMemo(() => {
    const search = q.trim().toLowerCase()
    if (!search) return reviews

    return reviews.filter((row) => {
      return (
        (row.product_name ?? "").toLowerCase().includes(search) ||
        row.product_id.toLowerCase().includes(search) ||
        row.user_id.toLowerCase().includes(search) ||
        String(row.rating).includes(search) ||
        (row.comment ?? "").toLowerCase().includes(search)
      )
    })
  }, [reviews, q])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">All Reviews</CardTitle>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search product, user, rating, comment..."
            className="w-full sm:w-80"
          />

          <Button variant="outline" onClick={loadAll} disabled={loading} className="w-full sm:w-auto">
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>

          <Button onClick={openCreate} className="w-full sm:w-auto" disabled={products.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Add Review
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {products.length === 0 ? (
          <div className="mb-4 rounded-md border px-3 py-2 text-sm text-muted-foreground">
            No products found. Create products before adding reviews.
          </div>
        ) : null}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No reviews found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.product_name ?? "(missing product)"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.product_id}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.user_id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        <span>{row.rating}/5</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{starsLabel(row.rating)}</div>
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <div className="line-clamp-2 break-words text-sm">{row.comment ?? "-"}</div>
                    </TableCell>
                    <TableCell>{formatDateTime(row.created_at)}</TableCell>
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
            <DialogTitle>{mode === "create" ? "Add Review" : "Edit Review"}</DialogTitle>
            <DialogDescription>
              Set product, user, rating, and optional review comment.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="review-user-id">User ID (UUID)</Label>
              <Input
                id="review-user-id"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="grid gap-2">
              <Label>Rating</Label>
              <Select value={rating} onValueChange={setRating}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 - Excellent</SelectItem>
                  <SelectItem value="4">4 - Good</SelectItem>
                  <SelectItem value="3">3 - Average</SelectItem>
                  <SelectItem value="2">2 - Poor</SelectItem>
                  <SelectItem value="1">1 - Very Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="review-comment">Comment (optional)</Label>
              <Textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write review comment..."
                rows={4}
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
            <AlertDialogTitle>Delete review?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the review for{" "}
              <span className="font-medium">{deleting?.product_name ?? "(missing product)"}</span>.
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
