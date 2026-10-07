"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/crawler/SignOutButton";
import type { TeamRole } from "@/lib/types";

const STORAGE_KEY = "sidebar-collapsed";

interface NavItem {
  href: string;
  label: string;
  icon: JSX.Element;
}

function ClientsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5 shrink-0">
      <rect x="3" y="4" width="7" height="7" rx="1" />
      <rect x="14" y="4" width="7" height="7" rx="1" />
      <rect x="3" y="15" width="7" height="5" rx="1" />
      <rect x="14" y="15" width="7" height="5" rx="1" />
    </svg>
  );
}

function CoverageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5 shrink-0">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15v-4" />
      <path d="M12 15V7" />
      <path d="M16 15v-6" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5 shrink-0">
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5 shrink-0">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M16 15.2c2.5.4 4 2 4 4.8" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={cn("h-4 w-4 shrink-0 transition-transform", collapsed && "rotate-180")}
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function Sidebar({
  isAdmin,
  userEmail,
  role,
}: {
  isAdmin: boolean;
  userEmail: string;
  role: TeamRole;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
    setMounted(true);
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  const navItems: NavItem[] = [
    { href: "/clients", label: "Clients", icon: <ClientsIcon /> },
    ...(isAdmin
      ? [
          { href: "/coverage", label: "Coverage", icon: <CoverageIcon /> },
          { href: "/monthly-reports", label: "Monthly Reports", icon: <ReportsIcon /> },
          { href: "/team", label: "Team", icon: <TeamIcon /> },
        ]
      : []),
  ];

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-background transition-[width] print:hidden",
        collapsed ? "w-16" : "w-56",
        !mounted && "transition-none",
      )}
    >
      <div className={cn("flex items-center gap-2 border-b border-border px-3 py-4", collapsed && "justify-center")}>
        {collapsed ? (
          <Link href="/clients" aria-label="CrawlR" className="text-lg font-bold">
            C
          </Link>
        ) : (
          <Link href="/clients" className="truncate font-semibold">
            CrawlR
          </Link>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              {item.icon}
              <span className={cn(collapsed && "sr-only")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={cn("space-y-2 border-t border-border p-3", collapsed && "flex flex-col items-center")}>
        {!collapsed && (
          <p className="truncate text-xs text-muted-foreground" title={userEmail}>
            {userEmail} · <span className="capitalize">{role}</span>
          </p>
        )}
        <SignOutButton />
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <CollapseIcon collapsed={collapsed} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
