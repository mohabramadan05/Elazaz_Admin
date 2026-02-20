import PromoCodesUsageClient from "@/components/dashboard/promo-codes-usage/promo-codes-usage-client"

export default function PromoCodesUsagePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Promo Codes Usage Rules</h1>
        <p className="text-sm text-muted-foreground">
          Track promo code usage by user and order based on the <code>promo_code_usages</code> table.
        </p>
      </div>

      <PromoCodesUsageClient />
    </div>
  )
}
