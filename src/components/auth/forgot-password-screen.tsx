"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { requestPasswordReset } from "@/features/auth/staff-sign-in";
import { loginPath } from "@/mock/auth";
import { AuthFrame } from "./auth-frame";
import s from "./login-screen.module.scss";

/** Staff ask for a reset link; the email opens /set-password, which finishes the reset. */
export function ForgotPasswordScreen({ portal }: { portal: "hr" | "admin" }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string>();
  const toast = useToast();

  return (
    <AuthFrame headline="Locked out? It happens." subline="We'll email you a link to choose a new password. It works once and expires in an hour.">
      <div className={s.card}>
        <h1 className={s.title}>Reset your password</h1>
        {sentTo ? (
          <Notice role="status" tone="success" icon={MailCheck} title="Check your inbox">
            If <strong>{sentTo}</strong> has a Campus Hire account, a reset link is on its way. It can take a minute; check spam too.
          </Notice>
        ) : (
          <>
            <p className={s.lead}>Enter your work email and we&apos;ll send you a reset link.</p>
            <form
              className={s.form}
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                setPending(true);
                const err = await requestPasswordReset(email);
                setPending(false);
                if (err) return toast({ tone: "danger", title: err });
                setSentTo(email.trim());
              }}
            >
              <Field label="Work email">
                <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Button type="submit" loading={pending}>
                Send reset link
              </Button>
            </form>
          </>
        )}
        <Link href={loginPath[portal]} className={`${s.link} ${s.back}`}>
          Back to sign in
        </Link>
      </div>
    </AuthFrame>
  );
}
