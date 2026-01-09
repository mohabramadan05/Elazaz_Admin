import ProductsClient from "@/components/dashboard/products/products-client"

export default function ProductsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="text-sm text-muted-foreground">
          Manage products (name, category, status). Variant images are managed in Variants.
        </p>
      </div>

      <ProductsClient />
    </div>
  )
}
