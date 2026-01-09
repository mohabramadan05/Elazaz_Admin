"use client";

import * as React from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Images,
  Upload,
  Star,
  StarOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProductRow = { id: string; name: string };
type SizeRow = { id: string; name: string };
type ColorRow = { id: string; name: string; hex_code: string | null };

type VariantRow = {
  id: string;
  product_id: string;
  size_id: string | null;
  color_id: string | null;
  sku: string | null;
  price: number;
  created_at: string;
  updated_at: string;
};

type VariantView = VariantRow & {
  product_name: string;
  size_name: string | null;
  color_name: string | null;
  main_image_url: string | null;
};

type VariantInsert = {
  product_id: string;
  size_id?: string | null;
  color_id?: string | null;
  sku?: string | null;
  price: number;
};

type VariantUpdate = Partial<VariantInsert>;

type VariantImageRow = {
  id: string;
  variant_id: string;
  image_url: string;
  is_main: boolean;
  created_at: string;
};

function moneyToNumber(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function extFromFile(file: File) {
  const parts = file.name.split(".");
  return (parts.length > 1 ? parts.pop() : "")?.toLowerCase() || "png";
}

// NOTE:
// - This uses public URLs for images.
// - Create a storage bucket named: "variants"
// - If you keep it PRIVATE, you must switch to signed URLs instead.
async function uploadVariantImage(file: File) {
  const bucket = "variants";
  const path = `${crypto.randomUUID()}.${extFromFile(file)}`;

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: file.type || undefined,
    });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl)
    throw new Error("Failed to get public URL for uploaded image.");
  return data.publicUrl;
}

export default function VariantsClient() {
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [sizes, setSizes] = React.useState<SizeRow[]>([]);
  const [colors, setColors] = React.useState<ColorRow[]>([]);
  const [variants, setVariants] = React.useState<VariantView[]>([]);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");

  // Variant form
  const [openForm, setOpenForm] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [editing, setEditing] = React.useState<VariantView | null>(null);

  const [productId, setProductId] = React.useState<string>("");
  const [sizeId, setSizeId] = React.useState<string>("__none__");
  const [colorId, setColorId] = React.useState<string>("__none__");
  const [sku, setSku] = React.useState("");
  const [price, setPrice] = React.useState("");

  // Delete confirm
  const [openDelete, setOpenDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState<VariantView | null>(null);

  // Images manager
  const [openImages, setOpenImages] = React.useState(false);
  const [imagesVariant, setImagesVariant] = React.useState<VariantView | null>(
    null
  );
  const [images, setImages] = React.useState<VariantImageRow[]>([]);
  const [imageFile, setImageFile] = React.useState<File | null>(null);

  async function loadAll() {
    setError(null);
    setLoading(true);

    const [
      { data: prod, error: prodErr },
      { data: sz, error: szErr },
      { data: col, error: colErr },
      { data: varr, error: varErr },
      { data: mains, error: mainErr },
    ] = await Promise.all([
      supabase
        .from("products")
        .select("id,name")
        .order("name", { ascending: true }),
      supabase
        .from("sizes")
        .select("id,name")
        .order("name", { ascending: true }),
      supabase
        .from("colors")
        .select("id,name,hex_code")
        .order("name", { ascending: true }),
      supabase
        .from("product_variants")
        .select(
          "id,product_id,size_id,color_id,sku,price,created_at,updated_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("variant_images")
        .select("variant_id,image_url,is_main")
        .eq("is_main", true),
    ]);

    setLoading(false);

    if (prodErr) return setError(prodErr.message);
    if (szErr) return setError(szErr.message);
    if (colErr) return setError(colErr.message);
    if (varErr) return setError(varErr.message);
    if (mainErr) return setError(mainErr.message);

    const productsRows = (prod ?? []) as ProductRow[];
    const sizesRows = (sz ?? []) as SizeRow[];
    const colorsRows = (col ?? []) as ColorRow[];
    const variantsRows = (varr ?? []) as VariantRow[];
    const mainRows = (mains ?? []) as {
      variant_id: string;
      image_url: string;
      is_main: boolean;
    }[];

    const pById = new Map(productsRows.map((p) => [p.id, p]));
    const sById = new Map(sizesRows.map((s) => [s.id, s]));
    const cById = new Map(colorsRows.map((c) => [c.id, c]));
    const mainByVariant = new Map(
      mainRows.map((m) => [m.variant_id, m.image_url])
    );

    setProducts(productsRows);
    setSizes(sizesRows);
    setColors(colorsRows);

    const view: VariantView[] = variantsRows.map((v) => ({
      ...v,
      product_name: pById.get(v.product_id)?.name ?? "—",
      size_name: v.size_id ? sById.get(v.size_id)?.name ?? null : null,
      color_name: v.color_id ? cById.get(v.color_id)?.name ?? null : null,
      main_image_url: mainByVariant.get(v.id) ?? null,
    }));

    setVariants(view);
  }

  React.useEffect(() => {
    loadAll();
  }, []);

  function openCreate() {
    setMode("create");
    setEditing(null);
    setProductId(products[0]?.id ?? "");
    setSizeId("__none__");
    setColorId("__none__");
    setSku("");
    setPrice("");
    setError(null);
    setOpenForm(true);
  }

  function openEdit(row: VariantView) {
    setMode("edit");
    setEditing(row);
    setProductId(row.product_id);
    setSizeId(row.size_id ?? "__none__");
    setColorId(row.color_id ?? "__none__");
    setSku(row.sku ?? "");
    setPrice(String(row.price ?? ""));
    setError(null);
    setOpenForm(true);
  }

  async function onSave() {
    setError(null);

    if (!productId) {
      setError("Product is required.");
      return;
    }

    const p = moneyToNumber(price.trim());
    if (!Number.isFinite(p) || p < 0) {
      setError("Price must be a valid number.");
      return;
    }

    setSaving(true);

    try {
      const payloadBase: VariantInsert = {
        product_id: productId,
        size_id: sizeId === "__none__" ? null : sizeId,
        color_id: colorId === "__none__" ? null : colorId,
        sku: sku.trim() || null,
        price: p,
      };

      if (mode === "create") {
        const { error } = await supabase
          .from("product_variants")
          .insert(payloadBase);
        if (error) throw error;

        await loadAll();
        setOpenForm(false);
        return;
      }

      if (!editing?.id) throw new Error("No variant selected.");

      const payload: VariantUpdate = payloadBase;

      const { error } = await supabase
        .from("product_variants")
        .update(payload)
        .eq("id", editing.id);

      if (error) throw error;

      await loadAll();
      setOpenForm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function askDelete(row: VariantView) {
    setDeleting(row);
    setOpenDelete(true);
  }

  async function confirmDelete() {
    if (!deleting?.id) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from("product_variants")
      .delete()
      .eq("id", deleting.id);

    setSaving(false);

    if (error) {
      setError(
        error.message.includes("violates foreign key constraint")
          ? "You can’t delete this variant because it’s referenced by orders/reviews."
          : error.message
      );
      setOpenDelete(false);
      return;
    }

    setVariants((prev) => prev.filter((v) => v.id !== deleting.id));
    setOpenDelete(false);
    setDeleting(null);
  }

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return variants;
    return variants.filter((v) => {
      return (
        v.product_name.toLowerCase().includes(s) ||
        (v.size_name ?? "").toLowerCase().includes(s) ||
        (v.color_name ?? "").toLowerCase().includes(s) ||
        (v.sku ?? "").toLowerCase().includes(s)
      );
    });
  }, [variants, q]);

  async function openImagesManager(v: VariantView) {
    setError(null);
    setImagesVariant(v);
    setImages([]);
    setImageFile(null);
    setOpenImages(true);

    const { data, error } = await supabase
      .from("variant_images")
      .select("id,variant_id,image_url,is_main,created_at")
      .eq("variant_id", v.id)
      .order("is_main", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setImages((data ?? []) as VariantImageRow[]);
  }

  async function uploadAndAddImage() {
    if (!imagesVariant?.id) return;
    if (!imageFile) {
      setError("Choose an image file first.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = await uploadVariantImage(imageFile);

      const makeMain = images.length === 0;

      if (makeMain) {
        const { error: unErr } = await supabase
          .from("variant_images")
          .update({ is_main: false })
          .eq("variant_id", imagesVariant.id)
          .eq("is_main", true);
        if (unErr) throw unErr;
      }

      const { error } = await supabase.from("variant_images").insert({
        variant_id: imagesVariant.id,
        image_url: url,
        is_main: makeMain,
      });

      if (error) throw error;

      await openImagesManager(imagesVariant);
      await loadAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      setSaving(false);
      setImageFile(null);
    }
  }

  async function setMainImage(img: VariantImageRow) {
    if (!imagesVariant?.id) return;
    setSaving(true);
    setError(null);

    try {
      const { error: unErr } = await supabase
        .from("variant_images")
        .update({ is_main: false })
        .eq("variant_id", imagesVariant.id)
        .eq("is_main", true);
      if (unErr) throw unErr;

      const { error: setErr } = await supabase
        .from("variant_images")
        .update({ is_main: true })
        .eq("id", img.id);
      if (setErr) throw setErr;

      await openImagesManager(imagesVariant);
      await loadAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to set main image.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteImage(img: VariantImageRow) {
    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase
        .from("variant_images")
        .delete()
        .eq("id", img.id);
      if (error) throw error;

      if (imagesVariant) {
        await openImagesManager(imagesVariant);
        await loadAll();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete image.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">All Variants</CardTitle>

          <div className="flex items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search product / size / color / sku…"
              className="w-72"
            />

            <Button variant="outline" onClick={loadAll} disabled={loading}>
              <RefreshCw
                className={
                  loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"
                }
              />
              Refresh
            </Button>

            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Variant
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
                  <TableHead>Image</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="w-56 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No variants found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.main_image_url ? (
                          <div className="relative h-10 w-10 overflow-hidden rounded border">
                            <Image
                              src={row.main_image_url}
                              alt="Variant main"
                              fill
                              sizes="40px"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded border bg-muted/40" />
                        )}
                      </TableCell>

                      <TableCell className="font-medium">
                        {row.product_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.size_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.color_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.sku ?? "—"}
                      </TableCell>
                      <TableCell className="font-medium">{row.price}</TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openImagesManager(row)}
                          >
                            <Images className="mr-2 h-4 w-4" />
                            Images
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => askDelete(row)}
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
            Required bucket: <span className="font-mono">variants</span>. If you
            keep it private, switch to signed URLs.
          </p>
        </CardContent>
      </Card>

      {/* Create/Edit Variant */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-190">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Add Variant" : "Edit Variant"}
            </DialogTitle>
            <DialogDescription>
              Variant = Product + (Size optional) + (Color optional) + Price +
              SKU
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Size (optional)</Label>
                <Select value={sizeId} onValueChange={setSizeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No size</SelectItem>
                    {sizes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Color (optional)</Label>
                <Select value={colorId} onValueChange={setColorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select color…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No color</SelectItem>
                    {colors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="sku">SKU (optional)</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g. HD-001-BLK-M"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 499"
                />
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenForm(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : mode === "create" ? "Create" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Variant */}
      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete variant?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this variant. If referenced by
              orders, deletion may be blocked.
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

      {/* Images Manager */}
      <Dialog open={openImages} onOpenChange={setOpenImages}>
        <DialogContent className="sm:max-w-225">
          <DialogHeader>
            <DialogTitle>Variant Images</DialogTitle>
            <DialogDescription>
              Upload multiple images. Mark exactly one as “Main”.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            <Button onClick={uploadAndAddImage} disabled={saving || !imageFile}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>

            <div className="text-sm text-muted-foreground">
              {imagesVariant ? (
                <>
                  Product:{" "}
                  <span className="font-medium">
                    {imagesVariant.product_name}
                  </span>
                  {" • "}
                  Size:{" "}
                  <span className="font-medium">
                    {imagesVariant.size_name ?? "—"}
                  </span>
                  {" • "}
                  Color:{" "}
                  <span className="font-medium">
                    {imagesVariant.color_name ?? "—"}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            {images.length === 0 ? (
              <div className="text-sm text-muted-foreground md:col-span-3">
                No images yet. Upload the first image — it will automatically
                become the Main image.
              </div>
            ) : (
              images.map((img) => (
                <div key={img.id} className="rounded-lg border p-3">
                  <div className="relative aspect-square overflow-hidden rounded-md border">
                    <Image
                      src={img.image_url}
                      alt="Variant image"
                      fill
                      sizes="300px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant={img.is_main ? "default" : "outline"}
                      onClick={() => setMainImage(img)}
                      disabled={saving}
                    >
                      {img.is_main ? (
                        <>
                          <Star className="mr-2 h-4 w-4" /> Main
                        </>
                      ) : (
                        <>
                          <StarOff className="mr-2 h-4 w-4" /> Set Main
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteImage(img)}
                      disabled={saving}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenImages(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
