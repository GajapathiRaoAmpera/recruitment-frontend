"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/input";
import { loadStaffSession } from "@/features/auth/staff-sign-in";
import { linkHash, supabase } from "@/lib/supabase";
import { useStore } from "@/mock/store";
import { AuthFrame } from "./auth-frame";
import s from "./login-screen.module.scss";

/** The session carried by the invite/reset link itself, or null when the page wasn't opened from one. */
function linkTokens() {
  const p = new URLSearchParams(linkHash?.slice(1) ?? "");
  const access_token = p.get("access_token");
  const refresh_token = p.get("refresh_token");
  return access_token && refresh_token ? { access_token, refresh_token } : null;
}

/**
 * Landing page of invite and reset links. It only ever works with the account in the link:
 * a session already in this browser (e.g. a signed-in Super Admin) must never get its password changed.
 */
export function SetPasswordScreen() {
  const router = useRouter();
  const { dispatch } = useStore();
  const [tokens] = useState(linkTokens);
  const [link, setLink] = useState<"checking" | "ok" | "invalid">(supabase && tokens ? "checking" : "invalid");
  const [email, setEmail] = useState<string>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!supabase || !tokens) return;
    // Switch this browser to the link's account, replacing anyone already signed in here.
    void supabase.auth.setSession(tokens).then(({ data, error }) => {
      if (error || !data.session) return setLink("invalid");
      setEmail(data.session.user.email);
      setLink("ok");
    });
  }, [tokens]);

  const submit = async () => {
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setPending(true);
    const { error: err } = await supabase!.auth.updateUser({ password });
    if (err) {
      setPending(false);
      return setError(`Couldn't save the password (${err.message}). Try again.`);
    }
    const res = await loadStaffSession();
    setPending(false);
    if ("error" in res) return setError(res.error);
    dispatch({ type: "login", session: res.session });
    router.push(res.home);
  };

  return (
    <AuthFrame headline="Welcome to Campus Hire." subline="Set a password once, then sign in to run campus drives from the first resume to the final decision.">
        <div className={s.card}>
          <h1 className={s.title}>Set your password</h1>
          {link === "checking" && (
            <p role="status" className={s.lead}>
              Checking your invite link…
            </p>
          )}
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
          {link === "ok" && (
            <>
              <p className={s.lead}>
                Choose the password for <strong>{email}</strong>. You&apos;ll use it to sign in to Campus Hire.
              </p>
              <form
                className={s.form}
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <Field label="New password" error={error}>
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
    </AuthFrame>
  );
}
