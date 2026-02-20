import OrdersClient from "@/components/dashboard/orders/orders-client"

export default function OrdersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Manage orders and update status: unpaid, paid, failed, preparing, done, cancelled.
        </p>
      </div>

      <OrdersClient />
    </div>
  )
}
