// app/dashboard/sizes/page.tsx
import SizesClient from "@/components/dashboard/sizes/sizes-client"

export default function SizesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Sizes</h1>
        <p className="text-sm text-muted-foreground">
          Manage product sizes (create, edit, delete).
        </p>
      </div>

      <SizesClient />
    </div>
  )
}
