"use client";

import type { ReactNode } from "react";
import { useStudent } from "@/components/student/hooks";
import s from "@/components/student/student.module.scss";
import { RobotLoader } from "@/components/ui/robot-loader";

export default function ExamLayout({ children }: { children: ReactNode }) {
  const { candidate, real } = useStudent();
  // A student signed in through the API has no mock candidate; they are identified by `real`.
  if (!candidate && !real) return <RobotLoader size="screen" label="Opening your test" />;
  return <div className={s.exam}>{children}</div>;
}
