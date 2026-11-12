import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const hook = vi.hoisted(() => ({ useStudent: vi.fn() }));
vi.mock("@/components/student/hooks", () => hook);

import ExamLayout from "./layout";

beforeEach(() => hook.useStudent.mockReset());

it("shows the exam to a student signed in through the API (it was blank before)", () => {
  hook.useStudent.mockReturnValue({ candidate: undefined, drive: undefined, real: { studentId: "S1" } });
  render(<ExamLayout>exam content</ExamLayout>);
  expect(screen.getByText("exam content")).toBeInTheDocument();
});

it("shows it to a prototype student, and nothing to someone not signed in", () => {
  hook.useStudent.mockReturnValue({ candidate: { id: "c1" }, real: undefined });
  const { unmount } = render(<ExamLayout>exam content</ExamLayout>);
  expect(screen.getByText("exam content")).toBeInTheDocument();
  unmount();
  hook.useStudent.mockReturnValue({ candidate: undefined, real: undefined });
  render(<ExamLayout>exam content</ExamLayout>);
  expect(screen.queryByText("exam content")).not.toBeInTheDocument();
});
