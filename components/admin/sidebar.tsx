"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Calendar, Users, Scissors, BarChart3,
  Settings, LogOut, Sparkles, UserCircle, CalendarOff, Package, Globe, KeyRound, Wallet,
  MoreHorizontal, X
} from "lucide-react";

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/appointments", label: "Appointments", icon: Calendar },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/staff", label: "Staff", icon: UserCircle },
  { href: "/admin/services", label: "Services", icon: Scissors },
  { href: "/admin/packages", label: "Packages", icon: Package },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarOff },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/accounting", label: "Accounting", icon: Wallet },
  { href: "/admin/website", label: "Website", icon: Globe },
  { href: "/admin/accounts", label: "Accounts", icon: KeyRound },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const staffNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/appointments", label: "Appointments", icon: Calendar },
  { href: "/admin/clients", label: "Clients", icon: Users },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string>("ADMIN");
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((u) => {
      if (u?.role) setRole(u.role);
    });
  }, []);

  const navItems = role === "STAFF" ? staffNavItems : adminNavItems;
  // Phone: first five sit in the bottom bar, the rest live behind "More"
  const barItems = navItems.slice(0, 5);
  const moreItems = navItems.slice(5);

  // Close the sheet after navigating
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">Salon Admin</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === href ? "bg-pink-50 text-pink-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-14 flex items-center px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-pink-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-gray-900">Salon Admin</span>
        </div>
        <button onClick={logout} className="ml-auto text-gray-500">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile "More" sheet — everything that doesn't fit in the bottom bar */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl pb-20 shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="font-semibold text-gray-900">More</span>
              <button onClick={() => setMoreOpen(false)} className="text-gray-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-3 pb-2">
              {moreItems.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium",
                    pathname === href ? "bg-pink-50 text-pink-700" : "text-gray-700 active:bg-gray-100"
                  )}>
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {label}
                </Link>
              ))}
              <button onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 active:bg-gray-100">
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex">
        {barItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-2 text-xs gap-1",
              pathname === href ? "text-pink-600" : "text-gray-400"
            )}>
            <Icon className="w-5 h-5" />
            <span className="truncate w-full text-center px-0.5">{label.split(" ")[0]}</span>
          </Link>
        ))}
        {moreItems.length > 0 && (
          <button onClick={() => setMoreOpen(true)}
            className={cn("flex-1 flex flex-col items-center justify-center py-2 text-xs gap-1",
              moreItems.some((i) => i.href === pathname) ? "text-pink-600" : "text-gray-400")}>
            <MoreHorizontal className="w-5 h-5" />
            <span>More</span>
          </button>
        )}
      </nav>
    </>
  );
}
