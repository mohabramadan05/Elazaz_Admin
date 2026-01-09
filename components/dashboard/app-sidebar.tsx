"use client";

import * as React from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Layers3,
  // Users,
  // ClipboardList,
  // Truck,
  // TicketPercent,
  // Star,
  // Settings2,
  Shield,
  // Database,
} from "lucide-react";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { NavMain } from "@/components/dashboard/nav-main";
import { NavUser } from "@/components/dashboard/nav-user";
import { TeamSwitcher } from "@/components/dashboard/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

// ✅ Admin sidebar structure (real e-commerce admin)
const data = {
  user: {
    name: "Admin",
    email: "admin@elazaz.com",
    avatar: "/avatars/admin.jpg",
  },
  teams: [
    {
      name: "EL Azaz",
      logo: Shield,
      plan: "Admin Panel",
    },
  ],
  navMain: [
    {
      title: "Overview",
      url: "/dashboard",
      icon: LayoutDashboard,
      isActive: true,
      items: [
        { title: "Dashboard", url: "/dashboard" },
        // { title: "Analytics", url: "/dashboard/analytics" },
      ],
    },

    {
      title: "Catalog",
      url: "/dashboard/catalog",
      icon: ShoppingBag,
      items: [
        { title: "Products", url: "/dashboard/products" },
        { title: "Variants", url: "/dashboard/variants" },
        { title: "Categories", url: "/dashboard/categories" },
      ],
    },

    {
      title: "Attributes",
      url: "/dashboard/attributes",
      icon: Layers3,
      items: [
        { title: "Sizes", url: "/dashboard/sizes" },
        { title: "Colors", url: "/dashboard/colors" },
      ],
    },

    // {
    //   title: "Orders",
    //   url: "/dashboard/orders",
    //   icon: ClipboardList,
    //   items: [
    //     { title: "All Orders", url: "/dashboard/orders" },
    //     { title: "Pending", url: "/dashboard/orders?status=pending" },
    //     { title: "Paid", url: "/dashboard/orders?status=paid" },
    //     { title: "Shipped", url: "/dashboard/orders?status=shipped" },
    //     { title: "Delivered", url: "/dashboard/orders?status=delivered" },
    //     { title: "Cancelled", url: "/dashboard/orders?status=cancelled" },
    //   ],
    // },

    // {
    //   title: "Shipping",
    //   url: "/dashboard/shipping",
    //   icon: Truck,
    //   items: [
    //     { title: "Carriers", url: "/dashboard/shipping/carriers" },
    //     { title: "Zones & Rates", url: "/dashboard/shipping/zones" },
    //   ],
    // },

    // {
    //   title: "Marketing",
    //   url: "/dashboard/marketing",
    //   icon: TicketPercent,
    //   items: [
    //     { title: "Promo Codes", url: "/dashboard/promo-codes" },
    //     { title: "Discount Rules", url: "/dashboard/discounts" },
    //   ],
    // },

    // {
    //   title: "Reviews",
    //   url: "/dashboard/reviews",
    //   icon: Star,
    //   items: [
    //     { title: "All Reviews", url: "/dashboard/reviews" },
    //     { title: "Reported", url: "/dashboard/reviews/reported" },
    //   ],
    // },

    // {
    //   title: "Customers",
    //   url: "/dashboard/customers",
    //   icon: Users,
    //   items: [
    //     { title: "Customers", url: "/dashboard/customers" },
    //     { title: "Admins", url: "/dashboard/admins" },
    //   ],
    // },

    // {
    //   title: "System",
    //   url: "/dashboard/system",
    //   icon: Database,
    //   items: [
    //     { title: "Data Entry", url: "/dashboard/data-entry" },
    //     { title: "Imports", url: "/dashboard/imports" },
    //     { title: "Exports", url: "/dashboard/exports" },
    //   ],
    // },

    // {
    //   title: "Settings",
    //   url: "/dashboard/settings",
    //   icon: Settings2,
    //   items: [
    //     { title: "Store Settings", url: "/dashboard/settings/store" },
    //     { title: "Payments", url: "/dashboard/settings/payments" },
    //     { title: "Security", url: "/dashboard/settings/security" },
    //   ],
    // },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="h-full">
          <NavMain items={data.navMain} />
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
