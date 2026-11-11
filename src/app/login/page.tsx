"use client";

import { CheckCircle2, MapPin, ShieldCheck, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DEMO_STUDENT } from "@/mock/data";
import { useStore } from "@/mock/store";
import s from "./login.module.scss";

const POINTS = [
  { icon: CheckCircle2, text: "HR approves every stage before candidates move on" },
  { icon: Timer, text: "Server-timed tests with saved progress" },
  { icon: ShieldCheck, text: "Full screen and tab-switch checks on every round" },
];

export default function LoginPage() {
  const [portal, setPortal] = useState<"staff" | "student">("staff");
  return (
    <div className={s.layout}>
      <aside className={s.aside}>
        <div aria-hidden className={s.glow} />
        <Logo height={30} />
        <div className={s.pitch}>
          <p className={s.headline}>Campus hiring, from resume to offer, in one place.</p>
          <p className={s.subline}>Shortlist resumes, run aptitude and coding rounds, interview with AI and decide — with HR in control of every step.</p>
          <ul className={s.points}>
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Icon aria-hidden size={16} /> {text}
              </li>
            ))}
          </ul>
        </div>
        <p className={s.copy}>© Ampera Technologies</p>
      </aside>
      <main className={s.panel}>
        <div className={s.card}>
          <div className={s.mobileLogo}>
            <Logo height={26} />
          </div>
          <div>
            <h1 className={s.title}>Welcome to Ampera Campus Hire</h1>
            <p className={s.lead}>Choose your portal to continue.</p>
          </div>
          <div role="tablist" aria-label="Portal" className={s.tabs}>
            <button role="tab" type="button" aria-selected={portal === "staff"} className={s.tab} onClick={() => setPortal("staff")}>
              Ampera staff
            </button>
            <button role="tab" type="button" aria-selected={portal === "student"} className={s.tab} onClick={() => setPortal("student")}>
              Student
            </button>
          </div>
          {portal === "staff" ? <StaffForm /> : <StudentForm />}
        </div>
      </main>
    </div>
  );
}

function StaffForm() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();

  const signIn = (userId: string) => {
    const user = state.staff.find((u) => u.id === userId)!;
    dispatch({ type: "login", session: { role: user.role, userId } });
    router.push(user.role === "SUPER_ADMIN" ? "/admin" : "/hr");
  };

  return (
    <form
      className={s.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const user = state.staff.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!user || !password) return setError("That email and password don't match an Ampera staff account.");
        if (!user.active) return setError("This account is deactivated. Ask a Super Admin to reactivate it.");
        signIn(user.id);
      }}
    >
      <Field label="Work email" error={error}>
        <Input type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(undefined); }} />
      </Field>
      <Field label="Password">
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit">Sign in</Button>
      <p className={s.divider}>Demo accounts</p>
      <div className={s.demo}>
        <Button variant="secondary" size="sm" onClick={() => signIn("u1")}>
          HR · Priya
        </Button>
        <Button variant="secondary" size="sm" onClick={() => signIn("u2")}>
          Super Admin · Alex
        </Button>
      </div>
    </form>
  );
}

function StudentForm() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const [studentId, setStudentId] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string>();

  return (
    <form
      className={s.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const c = state.candidates.find((x) => x.studentId.toLowerCase() === studentId.trim().toLowerCase() && x.dob === dob);
        // Same message for unknown ID and wrong DOB so the form can't be used to probe IDs.
        if (!c) return setError("Student ID and date of birth don't match the details from your registration form.");
        dispatch({ type: "login", session: { role: "STUDENT", candidateId: c.id } });
        router.push("/student");
      }}
    >
      <Field label="Student ID" hint="As entered in the campus Google Form." error={error}>
        <Input autoComplete="username" value={studentId} onChange={(e) => { setStudentId(e.target.value); setError(undefined); }} />
      </Field>
      <Field label="Date of birth">
        <Input type="date" value={dob} onChange={(e) => { setDob(e.target.value); setError(undefined); }} />
      </Field>
      <Button type="submit">
        <MapPin aria-hidden size={16} style={{ marginRight: 6 }} /> Verify and continue
      </Button>
      <p className={s.hint}>
        Demo student: <strong>{DEMO_STUDENT.studentId}</strong> · DOB <strong>{DEMO_STUDENT.dob}</strong>{" "}
        <button type="button" className={s.tab} onClick={() => { setStudentId(DEMO_STUDENT.studentId); setDob(DEMO_STUDENT.dob); }}>
          Fill
        </button>
      </p>
    </form>
  );
}
