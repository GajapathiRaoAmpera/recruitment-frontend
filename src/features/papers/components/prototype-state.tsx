import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/states";

/** Shown when Supabase is not configured: the paper builder needs a real sign-in and the API (no mock fallback). */
export function PrototypeState() {
  return (
    <EmptyState
      icon={<Lock aria-hidden size={32} />}
      title="Paper builder needs a real sign-in"
      description="This prototype runs without Supabase, so it cannot reach the paper API. Set the Supabase variables in .env.local and sign in as HR or Super Admin."
    />
  );
}
