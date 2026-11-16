"use client";

import { useState } from "react";
import { ApiError } from "@/api/client";
import { type InterviewStart, interviewStart } from "@/api/interviews";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import s from "./interview.module.scss";

/** Student ID + date of birth -> the interview token (POST /interview/start). */
export function InterviewLogin({ onNext }: { onNext: (i: InterviewStart) => void }) {
  const [id, setId] = useState("");
  const [dob, setDob] = useState("");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const info = await interviewStart(id, dob);
      if (info.status === "completed") toast({ tone: "danger", title: "You have already completed this interview." });
      else onNext(info);
    } catch (x) {
      toast({ tone: "danger", title: x instanceof ApiError ? x.message : "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className={s.center} onSubmit={submit}>
      <Logo height={24} />
      <h1>AI interview</h1>
      <Field label="Student ID" required>
        <Input value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Date of birth" required>
        <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      </Field>
      <Button type="submit" disabled={busy || !id.trim() || !dob}>
        {busy ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
