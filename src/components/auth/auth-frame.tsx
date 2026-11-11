import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Pipeline } from "@/components/brand/pipeline";
import s from "./login-screen.module.scss";

/** Navy auth page shared by sign-in, forgot-password and set-password: pipeline on the left, content on the right. */
export function AuthFrame({ headline, subline, children }: { headline: string; subline: string; children: ReactNode }) {
  return (
    <div className={s.page}>
      <header className={s.brand}>
        <Logo height={28} />
      </header>
      <section className={s.stage}>
        <Pipeline className={s.pipeline} />
        <div>
          <p className={s.headline}>{headline}</p>
          <p className={s.subline}>{subline}</p>
        </div>
      </section>
      <main className={s.side}>{children}</main>
      <footer className={s.copy}>© Ampera Technologies</footer>
    </div>
  );
}
