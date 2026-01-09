// app/dashboard/colors/page.tsx
import ColorsClient from "@/components/dashboard/colors/colors-client"

export default function ColorsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Colors</h1>
        <p className="text-sm text-muted-foreground">
          Manage product colors (create, edit, delete).
        </p>
      </div>

      <ColorsClient />
    </div>
  )
}
