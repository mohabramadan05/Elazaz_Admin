import AnalyticsClient from "@/components/dashboard/analytics/analytics-client"

export default function AnalyticsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Calculate gross and net profit for paid, done, and preparing orders with time filters.
        </p>
      </div>

      <AnalyticsClient />
    </div>
  )
}

