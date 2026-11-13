"use client";

import type { ReactNode } from "react";
import { useStudent } from "@/components/student/hooks";
import s from "@/components/student/student.module.scss";

export default function ExamLayout({ children }: { children: ReactNode }) {
  const { candidate, real } = useStudent();
  // A student signed in through the API has no mock candidate; they are identified by `real`.
  return <div className={s.exam}>{candidate || real ? children : null}</div>;
}
