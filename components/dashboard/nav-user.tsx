"use client"

import * as React from "react"
import { ChevronsUpDown, LogOut } from "lucide-react"

import { supabase } from "@/lib/supabase/client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

type ViewUser = {
  name: string
  email: string
  avatar: string
}

type UserMeta = {
  full_name?: string
  name?: string
  display_name?: string
  avatar_url?: string
  picture?: string
}

function initialsFromName(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? "U"
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return (first + last).toUpperCase()
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const [user, setUser] = React.useState<ViewUser | null>(null)

  const loadUser = React.useCallback(async () => {
    const { data, error } = await supabase.auth.getUser()

    if (error || !data?.user) {
      setUser(null)
      return
    }

    const u = data.user
    const meta = (u.user_metadata ?? {}) as UserMeta

    const name =
      meta.full_name ??
      meta.name ??
      meta.display_name ??
      u.email?.split("@")[0] ??
      "User"

    const email = u.email ?? ""

    const avatar = meta.avatar_url ?? meta.picture ?? ""

    setUser({ name, email, avatar })
  }, [])

  React.useEffect(() => {
    loadUser()

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadUser()
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [loadUser])

  const onLogout = async () => {
    await supabase.auth.signOut()
    // optional redirect
    // window.location.href = "/login"
  }

  if (!user) return null

  const initials = initialsFromName(user.name)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>

              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={onLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
