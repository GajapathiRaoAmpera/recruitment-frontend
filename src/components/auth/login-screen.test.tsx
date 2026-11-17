import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ToastProvider } from "@/components/ui/toast";
import { MockStoreProvider } from "@/mock/store";
import { LoginScreen } from "./login-screen";

const renderLogin = (portal: "student" | "hr") =>
  render(
    <MockStoreProvider>
      <ToastProvider>
        <LoginScreen portal={portal} />
      </ToastProvider>
    </MockStoreProvider>,
  );

describe("sign-in form checks both fields before signing in (AC-1)", () => {
  it("empty staff form: an error under each field, no sign-in", () => {
    renderLogin("hr");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Enter your work email.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("typing in a field clears only that field's error", () => {
    renderLogin("student");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.change(screen.getByLabelText("Student ID"), { target: { value: "ABC23CS014" } });
    expect(screen.queryByText("Enter your Student ID.")).not.toBeInTheDocument();
    expect(screen.getByText("Enter your date of birth.")).toBeInTheDocument();
  });

  it("prototype: the demo fill signs the HR user in", () => {
    renderLogin("hr");
    fireEvent.click(screen.getByRole("button", { name: "Fill in the demo account" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(push).toHaveBeenCalledWith("/hr");
  });
});
