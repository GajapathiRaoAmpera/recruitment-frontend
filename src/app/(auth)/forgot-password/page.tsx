import type { Metadata } from "next";
import { ForgotPasswordScreen } from "@/components/auth/forgot-password-screen";

export const metadata: Metadata = { title: "Reset your password" };

export default async function Page({ searchParams }: { searchParams: Promise<{ portal?: string }> }) {
  const { portal } = await searchParams;
  return <ForgotPasswordScreen portal={portal === "admin" ? "admin" : "hr"} />;
}
