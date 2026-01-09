"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import Image from "next/image";

type CategoryRow = {
  id: string;
  name: string;
  image_url: string | null;
  parent_id: string | null;
  created_at?: string;
};

type CategoryInsert = {
  name: string;
  parent_id: string | null;
  image_url?: string | null;
};

type CategoryUpdate = {
  name?: string;
  parent_id?: string | null;
  image_url?: string | null;
};

type CategoryNode = CategoryRow & { children: CategoryRow[] };

function buildTree(rows: CategoryRow[]): CategoryNode[] {
  const childrenMap = new Map<string, CategoryRow[]>();

  for (const r of rows) {
    if (r.parent_id) {
      const list = childrenMap.get(r.parent_id) ?? [];
      list.push(r);
      childrenMap.set(r.parent_id, list);
    }
  }

  return rows
    .filter((r) => !r.parent_id)
    .map((r) => ({
      ...r,
      children: (childrenMap.get(r.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getExtFromFile(file: File) {
  const parts = file.name.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  return (ext || "").toLowerCase();
}

export default function CategoriesClient() {
  const [rows, setRows] = React.useState<CategoryRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");

  // form dialog
  const [openForm, setOpenForm] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [editing, setEditing] = React.useState<CategoryRow | null>(null);

  const [name, setName] = React.useState("");
  const [parentId, setParentId] = React.useState<string>("__none__");

  // image upload state
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [removeImage, setRemoveImage] = React.useState(false);

  // delete confirm
  const [openDelete, setOpenDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState<CategoryRow | null>(null);

  async function load() {
    setError(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("categories")
      .select("id,name,image_url,parent_id,created_at")
      .order("name", { ascending: true });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setRows((data ?? []) as CategoryRow[]);
  }

  React.useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setMode("create");
    setEditing(null);
    setName("");
    setParentId("__none__");
    setImageFile(null);
    setRemoveImage(false);
    setError(null);
    setOpenForm(true);
  }

  function openEdit(row: CategoryRow) {
    setMode("edit");
    setEditing(row);
    setName(row.name ?? "");
    setParentId(row.parent_id ?? "__none__");
    setImageFile(null); // user can choose new file
    setRemoveImage(false);
    setError(null);
    setOpenForm(true);
  }

  async function uploadCategoryImage(file: File) {
    // Bucket name:
    const bucket = "categories";

    // Build a unique path. You can change this structure if you want.
    const ext = getExtFromFile(file) || "png";
    // const filename = `${crypto.randomUUID()}.${ext}`;
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) throw uploadError;

    // Public URL (bucket must be public)
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = data?.publicUrl;

    if (!publicUrl)
      throw new Error("Failed to retrieve public URL for uploaded image.");
    return publicUrl;
  }

  async function onSave() {
    setError(null);

    const cleanName = name.trim();
    const cleanParent = parentId === "__none__" ? null : parentId;

    if (!cleanName) {
      setError("Category name is required.");
      return;
    }

    // prevent selecting itself as parent (during edit)
    if (mode === "edit" && editing?.id && cleanParent === editing.id) {
      setError("A category cannot be its own parent.");
      return;
    }

    setSaving(true);

    try {
      let imageUrlToSave: string | null | undefined = undefined;
      // undefined => do not change image_url
      // null => remove image_url
      // string => set new url

      if (removeImage) {
        imageUrlToSave = null;
      } else if (imageFile) {
        imageUrlToSave = await uploadCategoryImage(imageFile);
      }

      if (mode === "create") {
        const payload: CategoryInsert = {
          name: cleanName,
          parent_id: cleanParent,
        };
        if (imageUrlToSave !== undefined) payload.image_url = imageUrlToSave;

        const { data, error } = await supabase
          .from("categories")
          .insert(payload)
          .select("id,name,image_url,parent_id,created_at")
          .single();
        console.log({ data, error });

        if (error) throw error;

        setRows((prev) => [...prev, data as CategoryRow]);
        setOpenForm(false);
        return;
      }

      if (!editing?.id) throw new Error("No category selected.");

      const payload: CategoryUpdate = {
        name: cleanName,
        parent_id: cleanParent,
      };
      if (imageUrlToSave !== undefined) payload.image_url = imageUrlToSave;

      const { data, error } = await supabase
        .from("categories")
        .update(payload)
        .eq("id", editing.id)
        .select("id,name,image_url,parent_id,created_at")
        .single();

      if (error) throw error;

      setRows((prev) =>
        prev.map((r) => (r.id === editing.id ? (data as CategoryRow) : r))
      );
      setOpenForm(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function askDelete(row: CategoryRow) {
    setDeleting(row);
    setOpenDelete(true);
  }

  async function confirmDelete() {
    if (!deleting?.id) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", deleting.id);

    setSaving(false);

    if (error) {
      const msg = error.message.includes("violates foreign key constraint")
        ? "You can’t delete this category because it’s used by one or more products (or its subcategories are used)."
        : error.message;
      setError(msg);
      setOpenDelete(false);
      return;
    }

    setOpenDelete(false);
    setDeleting(null);
    await load();
  }

  const parentsOnly = React.useMemo(() => {
    return rows
      .filter((r) => !r.parent_id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const tree = React.useMemo(() => buildTree(rows), [rows]);

  const filteredTree = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return tree;

    return tree
      .map((parent) => {
        const parentMatch =
          parent.name.toLowerCase().includes(s) ||
          (parent.image_url ?? "").toLowerCase().includes(s);

        const matchedChildren = parent.children.filter((c) => {
          return (
            c.name.toLowerCase().includes(s) ||
            (c.image_url ?? "").toLowerCase().includes(s)
          );
        });

        if (parentMatch) return parent;
        if (matchedChildren.length > 0)
          return { ...parent, children: matchedChildren };
        return null;
      })
      .filter(Boolean) as CategoryNode[];
  }, [tree, q]);

  const currentImageUrl = mode === "edit" ? editing?.image_url ?? null : null;
  const previewUrl = React.useMemo(() => {
    if (imageFile) return URL.createObjectURL(imageFile);
    return currentImageUrl;
  }, [imageFile, currentImageUrl]);

  React.useEffect(() => {
    return () => {
      // revoke object URL to avoid memory leaks
      if (imageFile) URL.revokeObjectURL(previewUrl as string);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openForm]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">All Categories</CardTitle>

          <div className="flex items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search categories…"
              className="w-60"
            />

            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw
                className={
                  loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"
                }
              />
              Refresh
            </Button>

            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
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
                  <TableHead>Category</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead className="w-35 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filteredTree.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No categories found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTree.flatMap((parent) => {
                    const parentRow = (
                      <TableRow key={parent.id}>
                        <TableCell className="font-medium">
                          {parent.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          —
                        </TableCell>
                        <TableCell>
                          {parent.image_url ? (
                            <a
                              className="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
                              href={parent.image_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ImageIcon className="h-4 w-4" />
                              View
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(parent)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => askDelete(parent)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );

                    const childRows = parent.children.map((child) => (
                      <TableRow key={child.id} className="bg-muted/20">
                        <TableCell className="pl-8">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">↳</span>
                            <span className="font-medium">{child.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {parent.name}
                        </TableCell>
                        <TableCell>
                          {child.image_url ? (
                            <a
                              className="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
                              href={child.image_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ImageIcon className="h-4 w-4" />
                              View
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(child)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => askDelete(child)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ));

                    return [parentRow, ...childRows];
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Tip: If a category (or its subcategories) is used by products,
            deletion will be blocked.
          </p>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-155">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Add Category" : "Edit Category"}
            </DialogTitle>
            <DialogDescription>
              Upload an image to Storage (bucket:{" "}
              <span className="font-mono">categories</span>) and save its URL.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shoes"
              />
            </div>

            <div className="grid gap-2">
              <Label>Parent Category (optional)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="No parent (top-level category)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No parent</SelectItem>
                  {parentsOnly
                    .filter((p) =>
                      mode === "edit" ? p.id !== editing?.id : true
                    )
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose a parent to create a subcategory.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Category Image</Label>

              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setImageFile(f);
                    if (f) setRemoveImage(false);
                  }}
                />

                {mode === "edit" && editing?.image_url ? (
                  <Button
                    type="button"
                    variant={removeImage ? "destructive" : "outline"}
                    onClick={() => setRemoveImage((v) => !v)}
                    className="gap-2"
                  >
                    {removeImage ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {removeImage ? "Will remove" : "Remove current"}
                  </Button>
                ) : null}
              </div>

              {previewUrl ? (
                <div className="mt-2 flex items-center gap-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-md border">
                    <Image
                      src={previewUrl}
                      alt="Category preview"
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized // ✅ because previewUrl can be blob: or external public URL
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {imageFile ? (
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        New file selected:{" "}
                        <span className="font-medium">{imageFile.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Current image
                      </div>
                    )}
                    <div className="mt-1">
                      {removeImage
                        ? "Image will be removed on save."
                        : "Image will be uploaded on save (if you selected a file)."}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No image selected.
                </p>
              )}
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
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

      {/* Delete confirm */}
      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium">{deleting?.name}</span>.
              Subcategories may also be deleted (cascade). If this category (or
              its children) is used by products, deletion will be blocked.
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
  );
}
