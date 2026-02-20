import UsersClient from "@/components/dashboard/users/users-client"

export default function AdminsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Admins</h1>
        <p className="text-sm text-muted-foreground">
          Manage admin profiles with related addresses and notifications.
        </p>
      </div>

      <UsersClient role="admin" />
    </div>
  )
}
