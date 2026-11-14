"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { exitFullscreen, useStudent } from "@/components/student/hooks";
import s from "@/components/student/student.module.scss";
import { useStore } from "@/mock/store";
import { RobotLoader } from "@/components/ui/robot-loader";

const NAV = [
  { href: "/student", label: "My dashboard" },
  { href: "/student/drive", label: "Drive details" },
  { href: "/student/results", label: "Status & result" },
];

export default function StudentLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dispatch } = useStore();
  const { candidate, drive, real } = useStudent();
  if (!candidate && !real) return <RobotLoader size="screen" label="Opening your dashboard" />;
  return (
    <>
      <header className={s.top}>
        <Link href="/student" aria-label="Student portal home">
          <Logo height={24} />
        </Link>
        <nav aria-label="Student" className={s.nav}>
          {(real ? NAV.slice(0, 1) : NAV).map((n) => (
            <Link key={n.href} href={n.href} className={s.navLink} aria-current={pathname === n.href ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <span className={s.spacer} />
        <div className={s.who}>
          <p style={{ fontWeight: 500 }}>{candidate?.name ?? real?.fullName}</p>
          <p style={{ color: "var(--ui-color-text-muted)", fontSize: "0.75rem" }}>
            {candidate?.studentId ?? real?.studentId}{drive ? ` · ${drive.campus}` : ""}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            dispatch({ type: "logout" });
            exitFullscreen(); // back to a normal window
            router.replace("/student/login");
          }}
        >
          Sign out
        </Button>
      </header>
      <main id="main" className={s.main}>
        {children}
      </main>
    </>
  );
}
