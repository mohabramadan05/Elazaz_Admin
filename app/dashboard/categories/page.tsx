import CategoriesClient from "@/components/dashboard/categories/categories-client"

export default function CategoriesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Manage categories and subcategories (parent/child).
        </p>
      </div>

      <CategoriesClient />
    </div>
  )
}
