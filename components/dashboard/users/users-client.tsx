"use client"

import * as React from "react"
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"

import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

type UserRole = "customer" | "admin"

type UsersClientProps = {
  role: UserRole
}

type ProfileRow = {
  id: string
  full_name: string | null
  image_url: string | null
  role: string
  created_at: string
  updated_at: string
}

type AddressRow = {
  id: string
  user_id: string
  country: string | null
  city: string | null
  street: string | null
  postal_code: string | null
  phone: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

type NotificationRow = {
  id: string
  user_id: string
  title: string
  description: string
  status: string
  created_at: string
  updated_at: string
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function safeText(value: string | null | undefined) {
  return value?.trim() || "-"
}

function titleByRole(role: UserRole) {
  return role === "admin" ? { singular: "Admin", plural: "Admins" } : { singular: "Customer", plural: "Customers" }
}

function mapDbError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes("violates foreign key constraint")) {
    return "Operation failed because this row is linked to related data."
  }
  if (lower.includes("duplicate key")) {
    return "A row with the same unique value already exists."
  }
  return message
}

export default function UsersClient({ role }: UsersClientProps) {
  const labels = React.useMemo(() => titleByRole(role), [role])
  const toggleTargetRole: UserRole = role === "customer" ? "admin" : "customer"
  const toggleLabel = role === "customer" ? "Make Admin" : "Make Customer"

  const [profiles, setProfiles] = React.useState<ProfileRow[]>([])
  const [addresses, setAddresses] = React.useState<AddressRow[]>([])
  const [notifications, setNotifications] = React.useState<NotificationRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [togglingRoleId, setTogglingRoleId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState("")

  const [openForm, setOpenForm] = React.useState(false)
  const [mode, setMode] = React.useState<"create" | "edit">("create")
  const [editing, setEditing] = React.useState<ProfileRow | null>(null)
  const [profileIdInput, setProfileIdInput] = React.useState("")
  const [fullName, setFullName] = React.useState("")
  const [imageUrl, setImageUrl] = React.useState("")

  const [openDelete, setOpenDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState<ProfileRow | null>(null)

  const [openDetails, setOpenDetails] = React.useState(false)
  const [selected, setSelected] = React.useState<ProfileRow | null>(null)

  const loadAll = React.useCallback(async () => {
    setError(null)
    setLoading(true)

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id,full_name,image_url,role,created_at,updated_at")
      .eq("role", role)
      .order("created_at", { ascending: false })

    if (profileError) {
      setLoading(false)
      setError(profileError.message)
      return
    }

    const profileRows = (profileData ?? []) as ProfileRow[]
    setProfiles(profileRows)

    if (profileRows.length === 0) {
      setAddresses([])
      setNotifications([])
      setLoading(false)
      return
    }

    const ids = profileRows.map((row) => row.id)
    const [{ data: addressesData, error: addressesError }, { data: notificationsData, error: notificationsError }] =
      await Promise.all([
        supabase
          .from("addresses")
          .select("id,user_id,country,city,street,postal_code,phone,is_default,created_at,updated_at")
          .in("user_id", ids)
          .order("created_at", { ascending: false }),
        supabase
          .from("notifications")
          .select("id,user_id,title,description,status,created_at,updated_at")
          .in("user_id", ids)
          .order("created_at", { ascending: false }),
      ])

    setLoading(false)

    if (addressesError) {
      setError(addressesError.message)
      return
    }
    if (notificationsError) {
      setError(notificationsError.message)
      return
    }

    setAddresses((addressesData ?? []) as AddressRow[])
    setNotifications((notificationsData ?? []) as NotificationRow[])
  }, [role])

  React.useEffect(() => {
    loadAll()
  }, [loadAll])

  const addressesCountByUser = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const row of addresses) map.set(row.user_id, (map.get(row.user_id) ?? 0) + 1)
    return map
  }, [addresses])

  const notificationsCountByUser = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const row of notifications) map.set(row.user_id, (map.get(row.user_id) ?? 0) + 1)
    return map
  }, [notifications])

  const selectedAddresses = React.useMemo(
    () => (selected ? addresses.filter((row) => row.user_id === selected.id) : []),
    [addresses, selected]
  )
  const selectedNotifications = React.useMemo(
    () => (selected ? notifications.filter((row) => row.user_id === selected.id) : []),
    [notifications, selected]
  )

  const filtered = React.useMemo(() => {
    const search = q.trim().toLowerCase()
    if (!search) return profiles
    return profiles.filter((row) => {
      return (
        (row.full_name ?? "").toLowerCase().includes(search) ||
        row.id.toLowerCase().includes(search) ||
        (row.image_url ?? "").toLowerCase().includes(search)
      )
    })
  }, [profiles, q])

  function openCreate() {
    setMode("create")
    setEditing(null)
    setProfileIdInput("")
    setFullName("")
    setImageUrl("")
    setError(null)
    setOpenForm(true)
  }

  function openEdit(row: ProfileRow) {
    setMode("edit")
    setEditing(row)
    setProfileIdInput("")
    setFullName(row.full_name ?? "")
    setImageUrl(row.image_url ?? "")
    setError(null)
    setOpenForm(true)
  }

  async function onSave() {
    setError(null)

    const cleanName = fullName.trim()
    if (!cleanName) {
      setError(`${labels.singular} full name is required.`)
      return
    }

    const cleanImageUrl = imageUrl.trim()
    setSaving(true)

    try {
      if (mode === "create") {
        const cleanId = profileIdInput.trim()
        const payload: { id?: string; full_name: string; image_url: string | null; role: string } = {
          full_name: cleanName,
          image_url: cleanImageUrl || null,
          role,
        }
        if (cleanId) payload.id = cleanId

        const { data, error } = await supabase
          .from("profiles")
          .insert(payload)
          .select("id,full_name,image_url,role,created_at,updated_at")
          .single()

        if (error) throw error
        setProfiles((prev) => [data as ProfileRow, ...prev])
        setOpenForm(false)
        return
      }

      if (!editing?.id) throw new Error(`No ${labels.singular.toLowerCase()} selected.`)

      const { data, error } = await supabase
        .from("profiles")
        .update({
          full_name: cleanName,
          image_url: cleanImageUrl || null,
          role,
        })
        .eq("id", editing.id)
        .select("id,full_name,image_url,role,created_at,updated_at")
        .single()

      if (error) throw error

      const updated = data as ProfileRow
      setProfiles((prev) => prev.map((row) => (row.id === editing.id ? updated : row)))
      if (selected?.id === editing.id) setSelected(updated)
      setOpenForm(false)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong."
      setError(mapDbError(message))
    } finally {
      setSaving(false)
    }
  }

  function askDelete(row: ProfileRow) {
    setDeleting(row)
    setOpenDelete(true)
  }

  async function confirmDelete() {
    if (!deleting?.id) return
    setSaving(true)
    setError(null)

    const { error } = await supabase.from("profiles").delete().eq("id", deleting.id)
    setSaving(false)

    if (error) {
      setError(mapDbError(error.message))
      setOpenDelete(false)
      return
    }

    setProfiles((prev) => prev.filter((row) => row.id !== deleting.id))
    setAddresses((prev) => prev.filter((row) => row.user_id !== deleting.id))
    setNotifications((prev) => prev.filter((row) => row.user_id !== deleting.id))
    if (selected?.id === deleting.id) setOpenDetails(false)
    setDeleting(null)
    setOpenDelete(false)
  }

  function openUserDetails(row: ProfileRow) {
    setSelected(row)
    setOpenDetails(true)
  }

  async function onToggleRole(row: ProfileRow) {
    setError(null)
    setTogglingRoleId(row.id)

    const { error } = await supabase
      .from("profiles")
      .update({ role: toggleTargetRole })
      .eq("id", row.id)

    setTogglingRoleId(null)

    if (error) {
      setError(mapDbError(error.message))
      return
    }

    setProfiles((prev) => prev.filter((profile) => profile.id !== row.id))
    setAddresses((prev) => prev.filter((address) => address.user_id !== row.id))
    setNotifications((prev) => prev.filter((notification) => notification.user_id !== row.id))

    if (selected?.id === row.id) {
      setSelected(null)
      setOpenDetails(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">All {labels.plural}</CardTitle>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${labels.plural.toLowerCase()}...`}
              className="w-full sm:w-72"
            />

            <Button variant="outline" onClick={loadAll} disabled={loading} className="w-full sm:w-auto">
              <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>

            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add {labels.singular}
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
                  <TableHead>User ID</TableHead>
                  <TableHead>Image URL</TableHead>
                  <TableHead>Addresses</TableHead>
                  <TableHead>Notifications</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="w-72 text-right">Actions</TableHead>
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
                      No {labels.plural.toLowerCase()} found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{safeText(row.full_name)}</TableCell>
                      <TableCell className="font-mono text-xs">{row.id}</TableCell>
                      <TableCell className="max-w-60">
                        <div className="line-clamp-1 text-sm text-muted-foreground">{safeText(row.image_url)}</div>
                      </TableCell>
                      <TableCell>{addressesCountByUser.get(row.id) ?? 0}</TableCell>
                      <TableCell>{notificationsCountByUser.get(row.id) ?? 0}</TableCell>
                      <TableCell>{formatDateTime(row.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                          <Button size="sm" variant="outline" onClick={() => openUserDetails(row)} className="w-full sm:w-auto">
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onToggleRole(row)}
                            disabled={togglingRoleId === row.id}
                            className="w-full sm:w-auto"
                          >
                            {togglingRoleId === row.id ? "Updating..." : toggleLabel}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)} className="w-full sm:w-auto">
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => askDelete(row)} className="w-full sm:w-auto">
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
      </Card>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? `Add ${labels.singular}` : `Edit ${labels.singular}`}</DialogTitle>
            <DialogDescription>Manage profile information for this role.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {mode === "create" ? (
              <div className="grid gap-2">
                <Label htmlFor="profile-id">Profile ID (optional)</Label>
                <Input
                  id="profile-id"
                  value={profileIdInput}
                  onChange={(e) => setProfileIdInput(e.target.value)}
                  placeholder="Leave empty if auto-generated"
                />
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="image-url">Image URL (optional)</Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="rounded-md border px-3 py-2 text-sm">
              Role: <span className="font-medium">{role}</span>
            </div>
          </div>

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
            <AlertDialogTitle>Delete {labels.singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <span className="font-medium">{safeText(deleting?.full_name)}</span>.
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

      <Dialog open={openDetails} onOpenChange={setOpenDetails}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{labels.singular} Details</DialogTitle>
            <DialogDescription>
              {selected ? `${safeText(selected.full_name)} (${selected.id})` : "Selected profile details"}
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">Full Name</div>
                  <div>{safeText(selected.full_name)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Role</div>
                  <div>{selected.role}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">User ID</div>
                  <div className="font-mono text-xs">{selected.id}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Image URL</div>
                  <div className="line-clamp-1">{safeText(selected.image_url)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Created At</div>
                  <div>{formatDateTime(selected.created_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Updated At</div>
                  <div>{formatDateTime(selected.updated_at)}</div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Addresses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Country</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>Street</TableHead>
                          <TableHead>Postal Code</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Default</TableHead>
                          <TableHead>Updated At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedAddresses.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                              No addresses found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedAddresses.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{safeText(row.country)}</TableCell>
                              <TableCell>{safeText(row.city)}</TableCell>
                              <TableCell>{safeText(row.street)}</TableCell>
                              <TableCell>{safeText(row.postal_code)}</TableCell>
                              <TableCell>{safeText(row.phone)}</TableCell>
                              <TableCell>{row.is_default ? "Yes" : "No"}</TableCell>
                              <TableCell>{formatDateTime(row.updated_at)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Updated At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedNotifications.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                              No notifications found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedNotifications.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">{row.title}</TableCell>
                              <TableCell className="max-w-lg">
                                <div className="line-clamp-2 break-words text-sm">{row.description}</div>
                              </TableCell>
                              <TableCell>{row.status}</TableCell>
                              <TableCell>{formatDateTime(row.updated_at)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
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
