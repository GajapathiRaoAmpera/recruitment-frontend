import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";

// Backend errors show only as toasts, so every rendered screen gets the provider the app layout gives it.
vi.mock("@testing-library/react", async (importOriginal) => {
  const rtl = await importOriginal<typeof import("@testing-library/react")>();
  const wrapper = ({ children }: { children: ReactNode }) => createElement(ToastProvider, null, children);
  return { ...rtl, render: ((ui: Parameters<typeof rtl.render>[0], opts?: Parameters<typeof rtl.render>[1]) => rtl.render(ui, { wrapper, ...opts })) as typeof rtl.render };
});

afterEach(() => cleanup());
