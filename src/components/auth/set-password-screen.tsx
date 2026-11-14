"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/input";
import { loginPath } from "@/mock/auth";
import { AuthFrame } from "./auth-frame";
import s from "./login-screen.module.scss";

const MIN = 10; // same rule as the API (WEAK_PASSWORD)

/**
 * Landing page of invite and reset links (`/set-password?token=…`). The token names the account
 * and works once; nothing about who is signed in on this browser changes.
 */
function SetPassword() {
  const token = useSearchParams().get("token");
  const [link, setLink] = useState<"ok" | "invalid" | "done">(token ? "ok" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (password.length < MIN) return setError(`Use at least ${MIN} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setPending(true);
    try {
      await api("/auth/set-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      setLink("done");
    } catch (e) {
      if (e instanceof ApiError && e.code === "LINK_INVALID") setLink("invalid");
      else setError(e instanceof ApiError ? e.message : "Couldn't save the password. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={s.card}>
      <h1 className={s.title}>{link === "done" ? "Password saved" : "Set your password"}</h1>
      {link === "invalid" && (
        <>
          <p role="alert" className={s.lead}>
            This link has expired or was already used.
          </p>
          <Link href="/forgot-password" className={s.link}>
            Get a new link
          </Link>
        </>
      )}
      {link === "done" && (
        <>
          <p role="status" className={s.lead}>
            You can now sign in with your email and new password.
          </p>
          <Link href={loginPath.hr} className={s.link}>
            Sign in as HR
          </Link>
          <Link href={loginPath.admin} className={s.link}>
            Sign in as Super Admin
          </Link>
        </>
      )}
      {link === "ok" && (
        <>
          <p className={s.lead}>Choose your password. You&apos;ll use it with your work email to sign in to Campus Hire.</p>
          <form
            className={s.form}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Field label="New password" hint={`At least ${MIN} characters`} error={error}>
              <PasswordInput autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(undefined); }} />
            </Field>
            <Field label="Repeat password">
              <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(undefined); }} />
            </Field>
            <Button type="submit" loading={pending}>
              Save password
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

export function SetPasswordScreen() {
  return (
    <AuthFrame headline="Welcome to Campus Hire." subline="Set a password once, then sign in to run campus drives from the first resume to the final decision.">
      <Suspense>
        <SetPassword />
      </Suspense>
    </AuthFrame>
  );
}
