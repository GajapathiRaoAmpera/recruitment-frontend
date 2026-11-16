"use client";

import * as RD from "@radix-ui/react-dialog";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, useSyncExternalStore } from "react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { overlayClasses } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { isActive, navItems, type NavItem } from "@/lib/nav";
import type { Role } from "@/mock/types";
import { safeStorage } from "@/lib/storage";
import { homePath, portalOf } from "@/mock/auth";
import s from "./sidebar.module.scss";

const COLLAPSED_KEY = "ampera.sidebar.collapsed";
// Read through useSyncExternalStore so the server render (always expanded) and the first client render agree.
const collapsedListeners = new Set<() => void>();
const subscribeCollapsed = (l: () => void) => {
  collapsedListeners.add(l);
  return () => void collapsedListeners.delete(l);
};
const readCollapsed = () => safeStorage.get(COLLAPSED_KEY) === "1";

interface NavListProps {
  role: Role;
  collapsed?: boolean;
  onNavigate?: () => void;
}

/**
 * The current path is request data in Next 16: read it inside <Suspense> so the static shell
 * (same links, no active highlight) can prerender for dynamic routes like /projects/[id].
 */
function NavList(props: NavListProps) {
  return (
    <Suspense fallback={<NavLinks {...props} pathname={null} />}>
      <ActiveNavLinks {...props} />
    </Suspense>
  );
}

function ActiveNavLinks(props: NavListProps) {
  return <NavLinks {...props} pathname={usePathname()} />;
}

function NavLinks({ role, collapsed = false, onNavigate, pathname }: NavListProps & { pathname: string | null }) {
  const items = navItems(role);
  const sections: { key: NavItem["section"]; title?: string }[] = [{ key: "main" }, { key: "admin", title: "Admin" }];

  return (
    <nav aria-label="Main" className={s.nav}>
      {sections.map(({ key, title }) => {
        const list = items.filter((i) => i.section === key);
        if (list.length === 0) return null;
        return (
          <div key={key}>
            {title && !collapsed && (
              <p className={s.sectionTitle}>{title}</p>
            )}
            <ul className={s.list}>
              {list.map((item) => {
                const active = pathname !== null && isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(s.link, collapsed && s.collapsedLink)}
                    >
                      <Icon aria-hidden size={20} className={s.icon} />
                      <span className={cn(collapsed && "sr-only")}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar({ role }: { role: Role }) {
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);

  const toggle = () => {
    safeStorage.set(COLLAPSED_KEY, collapsed ? "0" : "1");
    collapsedListeners.forEach((l) => l());
  };

  return (
    <aside
      className={cn(s.aside, collapsed && s.asideCollapsed)}
    >
      <div className={cn(s.brand, collapsed && s.brandCollapsed)}>
        <Link href={homePath[portalOf(role)]} aria-label="Ampera Campus Hire home">
          {collapsed ? <LogoMark /> : <Logo height={26} />}
        </Link>
      </div>
      <div className={s.grow}>
        <NavList role={role} collapsed={collapsed} />
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(s.toggle, collapsed && s.collapsedLink)}
      >
        {collapsed ? <PanelLeftOpen aria-hidden size={20} /> : <PanelLeftClose aria-hidden size={20} />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}

/** Below 768px the sidebar becomes a drawer opened from the header. */
export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  return (
    <RD.Root open={open} onOpenChange={setOpen}>
      <RD.Trigger
        aria-label="Menu"
        className={s.menuButton}
      >
        <Menu aria-hidden size={20} />
      </RD.Trigger>
      <RD.Portal>
        <RD.Overlay className={overlayClasses} />
        <RD.Content
          aria-describedby={undefined}
          className={s.drawer}
        >
          <div className={s.drawerHead}>
            <RD.Title className="sr-only">Navigation</RD.Title>
            <Logo height={26} />
            <RD.Close aria-label="Close menu" className={s.drawerClose}>
              <X aria-hidden size={20} />
            </RD.Close>
          </div>
          <NavList role={role} onNavigate={() => setOpen(false)} />
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
