"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { entryVerify } from "@/api/entry";
import { signInStaff } from "@/features/auth/staff-sign-in";
import { liveApi } from "@/lib/auth";
import { signIn, type Portal } from "@/mock/auth";
import { DEMO_STUDENT } from "@/mock/data";
import { useStore } from "@/mock/store";
import { AuthFrame } from "./auth-frame";
import s from "./login-screen.module.scss";

const COPY: Record<Portal, { title: string; lead: string; demo: { identifier: string; secret: string } }> = {
  student: {
    title: "Student sign in",
    lead: "Use the Student ID and date of birth from your campus registration form.",
    demo: { identifier: DEMO_STUDENT.studentId, secret: DEMO_STUDENT.dob },
  },
  hr: {
    title: "HR sign in",
    lead: "Sign in with your Ampera work email to manage campus drives.",
    demo: { identifier: "priya.sharma@ampera.tech", secret: "demo" }, // prototype accepts any password
  },
  admin: {
    title: "Super Admin sign in",
    lead: "System access for users, AI prompts and audit logs.",
    demo: { identifier: "alex.chen@ampera.tech", secret: "demo" },
  },
};

type Errors = { identifier?: string; secret?: string };

/** Sign-in for one role. Each role has its own URL (/student/login, /hr/login, /admin/login). */
export function LoginScreen({ portal }: { portal: Portal }) {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const copy = COPY[portal];
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const student = portal === "student";
  // Staff sign in through the API when it's on (NEXT_PUBLIC_LIVE_API); otherwise the prototype.
  const realStaff = !student && liveApi;
  const prototype = !liveApi;

  const validate = (): Errors => ({
    identifier: identifier.trim() ? undefined : student ? "Enter your Student ID." : "Enter your work email.",
    secret: secret ? undefined : student ? "Enter your date of birth." : "Enter your password.",
  });

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
            const found = validate();
            if (found.identifier || found.secret) return setErrors(found);
            setPending(true);
            if (student && liveApi) {
              // Real student sign-in: the API checks Student ID + DOB against the imported candidates.
              try {
                dispatch({ type: "login", session: { role: "STUDENT", student: await entryVerify(identifier, secret) } });
                return router.push("/student");
              } catch (err) {
                return toast({ tone: "danger", title: (err as Error).message });
              } finally {
                setPending(false);
              }
            }
            const res = realStaff ? await signInStaff(portal, identifier, secret) : signIn(state, portal, identifier, secret);
            setPending(false);
            if ("error" in res) return toast({ tone: "danger", title: res.error });
            dispatch({ type: "login", session: res.session });
            router.push(res.home);
          }}
        >
          <Field label={student ? "Student ID" : "Work email"} error={errors.identifier}>
            <Input
              type={student ? "text" : "email"}
              autoComplete="username"
              autoFocus
              placeholder={student ? "e.g. ABC23CS014" : "name@ampera.tech"}
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setErrors((x) => ({ ...x, identifier: undefined }));
              }}
            />
          </Field>
          {student ? (
            <Field label="Date of birth" error={errors.secret}>
              <Input type="date" value={secret} onChange={(e) => { setSecret(e.target.value); setErrors((x) => ({ ...x, secret: undefined })); }} />
            </Field>
          ) : (
            <Field label="Password" error={errors.secret}>
              <PasswordInput autoComplete="current-password" value={secret} onChange={(e) => { setSecret(e.target.value); setErrors((x) => ({ ...x, secret: undefined })); }} />
            </Field>
          )}
          {realStaff && (
            <Link href={`/forgot-password?portal=${portal}`} className={s.link}>
              Forgot password?
            </Link>
          )}
          <Button type="submit" loading={pending} className={s.submit}>
            Sign in
          </Button>
        </form>
        {prototype && (
          <div className={s.demo}>
            <span>Prototype mode: sample data, no real accounts.</span>
            <button
              type="button"
              className={s.demoFill}
              onClick={() => {
                setIdentifier(copy.demo.identifier);
                setSecret(copy.demo.secret);
                setErrors({});
              }}
            >
              Fill in the demo account
            </button>
          </div>
        )}
      </div>
    </AuthFrame>
  );
}
