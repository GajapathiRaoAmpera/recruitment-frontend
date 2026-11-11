"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useStudent } from "@/components/student/hooks";
import s from "@/components/student/student.module.scss";
import { useStore } from "@/mock/store";

const NAV = [
  { href: "/student", label: "My dashboard" },
  { href: "/student/drive", label: "Drive details" },
  { href: "/student/results", label: "Status & result" },
];

export default function StudentLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dispatch } = useStore();
  const { candidate, drive } = useStudent();
  return (
    <>
      <header className={s.top}>
        <Link href="/student" aria-label="Student portal home">
          <Logo height={24} />
        </Link>
        <nav aria-label="Student" className={s.nav}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={s.navLink} aria-current={pathname === n.href ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <span className={s.spacer} />
        {candidate && (
          <div className={s.who}>
            <p style={{ fontWeight: 500 }}>{candidate.name}</p>
            <p style={{ color: "var(--ui-color-text-muted)", fontSize: "0.75rem" }}>
              {candidate.studentId} · {drive?.campus}
            </p>
          </div>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            dispatch({ type: "logout" });
            router.replace("/student/login");
          }}
        >
          Sign out
        </Button>
      </header>
      <main id="main" className={s.main}>
        {candidate ? children : null}
      </main>
    </>
  );
}
