"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { homePath, loginPath, portalOf } from "@/mock/auth";
import { useStore } from "@/mock/store";
import { Breadcrumbs, BreadcrumbsProvider } from "./breadcrumbs";
import { ProfileMenu } from "./profile-menu";
import s from "./shell.module.scss";
import { MobileNav, Sidebar } from "./sidebar";

/** Staff frame (HR + Super Admin). The signed-in account decides the role; there is no role switching. */
export function AppShell({ children }: { children: ReactNode }) {
  const { state, ready } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const session = state.session;
  const staffSession = session && session.role !== "STUDENT" ? session : null;

  useEffect(() => {
    if (!ready || staffSession) return;
    // Signed-in students go home; everyone else goes to the login of the area they tried to open.
    router.replace(session ? homePath[portalOf(session.role)] : loginPath[pathname.startsWith("/admin") ? "admin" : "hr"]);
  }, [ready, staffSession, session, pathname, router]);

  const user = state.staff.find((u) => u.id === staffSession?.userId);
  const role = staffSession?.role ?? "HR";
  return (
    <BreadcrumbsProvider>
      <a href="#main" className={s.skip}>
        Skip to main content
      </a>
      <div className={s.frame}>
        <Sidebar role={role} />
        <div className={s.column}>
          <header className={s.header}>
            <MobileNav role={role} />
            <div className={s.crumbSlot}>
              <Breadcrumbs />
            </div>
            {user && <ProfileMenu user={user} />}
          </header>
          <main id="main" tabIndex={-1} className={s.main}>
            <div className={s.container}>{user ? children : null}</div>
          </main>
        </div>
      </div>
    </BreadcrumbsProvider>
  );
}
