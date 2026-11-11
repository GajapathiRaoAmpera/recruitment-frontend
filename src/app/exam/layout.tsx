"use client";

import type { ReactNode } from "react";
import { useStudent } from "@/components/student/hooks";
import s from "@/components/student/student.module.scss";

export default function ExamLayout({ children }: { children: ReactNode }) {
  const { candidate } = useStudent();
  return <div className={s.exam}>{candidate ? children : null}</div>;
}
