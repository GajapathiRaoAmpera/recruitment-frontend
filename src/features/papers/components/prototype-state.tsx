import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/states";

/** Shown when Supabase is not configured: the feature needs a real sign-in and the API (no mock fallback). */
export function PrototypeState({ feature = "Paper builder" }: { feature?: string }) {
  return (
    <EmptyState
      icon={<Lock aria-hidden size={32} />}
      title={`${feature} needs a real sign-in`}
      description="This prototype runs without Supabase, so it cannot reach the API. Set the Supabase variables in .env.local and sign in as HR or Super Admin."
    />
  );
}
