import ReviewsClient from "@/components/dashboard/reviews/reviews-client"

export default function ReviewsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Manage product reviews (rating and comment) linked to product and user.
        </p>
      </div>

      <ReviewsClient />
    </div>
  )
}
