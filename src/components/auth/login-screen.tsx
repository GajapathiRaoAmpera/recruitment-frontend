"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { signInStaff } from "@/features/auth/staff-sign-in";
import { supabase } from "@/lib/supabase";
import { signIn, type Portal } from "@/mock/auth";
import { DEMO_STUDENT } from "@/mock/data";
import { useStore } from "@/mock/store";
import { AuthFrame } from "./auth-frame";
import s from "./login-screen.module.scss";

const COPY: Record<Portal, { title: string; lead: string; demo: React.ReactNode }> = {
  student: {
    title: "Student sign in",
    lead: "Use the Student ID and date of birth from your campus registration form.",
    demo: (
      <>
        Prototype student: <strong>{DEMO_STUDENT.studentId}</strong>, DOB <strong>{DEMO_STUDENT.dob}</strong>.
      </>
    ),
  },
  hr: {
    title: "HR sign in",
    lead: "Sign in with your Ampera work email to manage campus drives.",
    demo: (
      <>
        Prototype HR: <strong>priya.sharma@ampera.tech</strong> (any password).
      </>
    ),
  },
  admin: {
    title: "Super Admin sign in",
    lead: "System access for users, AI prompts and audit logs.",
    demo: (
      <>
        Prototype Super Admin: <strong>alex.chen@ampera.tech</strong> (any password).
      </>
    ),
  },
};

/** Sign-in for one role. Each role has its own URL (/student/login, /hr/login, /admin/login). */
export function LoginScreen({ portal }: { portal: Portal }) {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string>();
  const copy = COPY[portal];
  const [pending, setPending] = useState(false);
  const student = portal === "student";
  // Staff use real Supabase sign-in once it's configured; students stay on the prototype until Phase 1.3.
  const realStaff = !student && supabase !== null;
  const clear = () => setError(undefined);

  return (
    <AuthFrame
      headline="Every campus drive, from the first resume to the final decision."
      subline="Students take each round from one link. HR sees every result and decides who moves on."
    >
        <div className={s.card}>
          <h1 className={s.title}>{copy.title}</h1>
          <p className={s.lead}>{copy.lead}</p>
          <form
            className={s.form}
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              const res = realStaff ? await signInStaff(portal, identifier, secret) : signIn(state, portal, identifier, secret);
              setPending(false);
              if ("error" in res) return setError(res.error);
              dispatch({ type: "login", session: res.session });
              router.push(res.home);
            }}
          >
            <Field label={student ? "Student ID" : "Work email"} error={error}>
              <Input type={student ? "text" : "email"} autoComplete="username" value={identifier} onChange={(e) => { setIdentifier(e.target.value); clear(); }} />
            </Field>
            {student ? (
              <Field label="Date of birth">
                <Input type="date" value={secret} onChange={(e) => { setSecret(e.target.value); clear(); }} />
              </Field>
            ) : (
              <Field label="Password">
                <PasswordInput autoComplete="current-password" value={secret} onChange={(e) => { setSecret(e.target.value); clear(); }} />
              </Field>
            )}
            {realStaff && (
              <Link href={`/forgot-password?portal=${portal}`} className={s.link}>
                Forgot password?
              </Link>
            )}
            <Button type="submit" loading={pending}>
              Sign in
            </Button>
          </form>
        </div>
        {!realStaff && <p className={s.demo}>{copy.demo}</p>}
    </AuthFrame>
  );
}
