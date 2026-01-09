"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = React.useState(true)

  React.useEffect(() => {
    let isActive = true

    async function checkSession() {
      const { data } = await supabase.auth.getSession()

      if (!isActive) {
        return
      }

      if (!data.session) {
        router.replace("/")
        return
      }

      setChecking(false)
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/")
      }
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [router])

  if (checking) {
    return null
  }

  return <>{children}</>
}
