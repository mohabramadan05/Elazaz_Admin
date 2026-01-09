import VariantsClient from "@/components/dashboard/variants/variants-client"

export default function VariantsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Variants</h1>
        <p className="text-sm text-muted-foreground">
          Manage product variants (size + color + price + sku) and variant images.
        </p>
      </div>

      <VariantsClient />
    </div>
  )
}
