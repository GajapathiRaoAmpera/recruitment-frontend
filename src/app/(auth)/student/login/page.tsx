import type { Metadata } from "next";
import { LoginScreen } from "@/components/auth/login-screen";

export const metadata: Metadata = { title: "Student sign in" };

export default function Page() {
  return <LoginScreen portal="student" />;
}
