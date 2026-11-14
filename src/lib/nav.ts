import { Building2, ClipboardList, FolderKanban, LayoutDashboard, type LucideIcon, ScrollText, Settings2, Users, Video } from "lucide-react";
import type { Role } from "@/mock/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  section: "main" | "admin";
}

export function navItems(role: Role): NavItem[] {
  const items: NavItem[] = [
    { label: "Dashboard", href: "/hr", icon: LayoutDashboard, section: "main" },
    { label: "Drives", href: "/hr/drives", icon: FolderKanban, section: "main" },
    { label: "Interviews", href: "/hr/interviews", icon: Video, section: "main" },
  ];
  if (role === "SUPER_ADMIN") {
    items.push(
      { label: "Overview", href: "/admin", icon: ClipboardList, section: "admin" },
      { label: "Users & roles", href: "/admin/users", icon: Users, section: "admin" },
      { label: "Colleges", href: "/admin/colleges", icon: Building2, section: "admin" },
      { label: "AI settings", href: "/admin/ai-settings", icon: Settings2, section: "admin" },
      { label: "Audit logs", href: "/admin/audit-logs", icon: ScrollText, section: "admin" },
    );
  }
  return items;
}

/** Exact match for section roots (/hr, /admin) so they don't stay highlighted on child pages. */
export function isActive(pathname: string, href: string) {
  if (href === "/hr" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
