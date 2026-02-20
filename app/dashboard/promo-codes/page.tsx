import PromoCodesClient from "@/components/dashboard/promo-codes/promo-codes-client"

export default function PromoCodesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Promo Codes</h1>
        <p className="text-sm text-muted-foreground">
          Manage promo codes, discount percentages, activity status, expiry, and per-user limits.
        </p>
      </div>

      <PromoCodesClient />
    </div>
  )
}
