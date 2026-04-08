"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Upload,
  UtensilsCrossed,
  BarChart3,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/imports", label: "Import", icon: Upload },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/nutrition", label: "Nutrition", icon: BarChart3 },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-card border-r border-border flex flex-col z-10">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold text-primary">Food Tracker</h1>
        <p className="text-xs text-muted-foreground">Inventory & Nutrition</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
