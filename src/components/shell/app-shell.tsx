"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useStore } from "@/mock/store";
import { Breadcrumbs, BreadcrumbsProvider } from "./breadcrumbs";
import { ProfileMenu } from "./profile-menu";
import s from "./shell.module.scss";
import { MobileNav, Sidebar } from "./sidebar";

/** Staff frame (HR + Super Admin). A cold deep link signs in the matching demo user so every URL works on its own. */
export function AppShell({ children }: { children: ReactNode }) {
  const { state, dispatch } = useStore();
  const pathname = usePathname();
  const session = state.session;
  const staffSession = session && session.role !== "STUDENT" ? session : null;

  useEffect(() => {
    if (staffSession) return;
    const admin = pathname.startsWith("/admin");
    dispatch({ type: "login", session: { role: admin ? "SUPER_ADMIN" : "HR", userId: admin ? "u2" : "u1" } });
  }, [staffSession, pathname, dispatch]);

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
