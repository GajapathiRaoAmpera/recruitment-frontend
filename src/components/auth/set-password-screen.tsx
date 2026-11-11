"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loadStaffSession } from "@/features/auth/staff-sign-in";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/mock/store";
import s from "./login-screen.module.scss";

/** Landing page of the staff invite email: supabase-js reads the invite tokens from the URL, the user picks a password. */
export function SetPasswordScreen() {
  const router = useRouter();
  const { dispatch } = useStore();
  const [link, setLink] = useState<"checking" | "ok" | "invalid">(supabase ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setLink(session ? "ok" : "invalid"));
    return () => data.subscription.unsubscribe();
  }, []);

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
    <div className={s.page}>
      <header className={s.brand}>
        <Logo height={28} />
      </header>
      <main className={s.side}>
        <div className={s.card}>
          <h1 className={s.title}>Set your password</h1>
          {link === "checking" && (
            <p role="status" className={s.lead}>
              Checking your invite link…
            </p>
          )}
          {link === "invalid" && (
            <p role="alert" className={s.lead}>
              This invite link has expired or was already used. Ask your Super Admin to send you a new one.
            </p>
          )}
          {link === "ok" && (
            <>
              <p className={s.lead}>Choose the password you&apos;ll use to sign in to Campus Hire.</p>
              <form
                className={s.form}
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <Field label="New password" error={error}>
                  <Input type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(undefined); }} />
                </Field>
                <Field label="Repeat password">
                  <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(undefined); }} />
                </Field>
                <Button type="submit" loading={pending}>
                  Save password
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
      <footer className={s.copy}>© Ampera Technologies</footer>
    </div>
  );
}
