"use client";

import type { ReactNode } from "react";
import { useStudent } from "@/components/student/hooks";
import s from "@/components/student/student.module.scss";
import { RocketLoader } from "@/components/ui/rocket-loader";

export default function ExamLayout({ children }: { children: ReactNode }) {
  const { candidate, real } = useStudent();
  // A student signed in through the API has no mock candidate; they are identified by `real`.
  if (!candidate && !real) return <RocketLoader size="screen" label="Opening your test" />;
  return <div className={s.exam}>{children}</div>;
}
