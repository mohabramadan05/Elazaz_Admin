import DashboardOverviewClient from "@/components/dashboard/overview/dashboard-overview-client"

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview charts and key metrics for orders and profit trends.
        </p>
      </div>

      <DashboardOverviewClient />
    </div>
  )
}
