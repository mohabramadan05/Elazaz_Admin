import UsersClient from "@/components/dashboard/users/users-client"

export default function CustomersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Manage customer profiles with related addresses and notifications.
        </p>
      </div>

      <UsersClient role="customer" />
    </div>
  )
}
