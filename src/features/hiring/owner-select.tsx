"use client";

import { listHrOwners } from "@/api/hiring";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { useAsync } from "@/features/papers/use-async";

export const KEEP_WITH_ME = "me";

interface OwnerSelectProps {
  value: string;
  /** The id, plus the option text so callers can show who they picked. */
  onChange: (ownerId: string, label: string) => void;
  error?: string;
  /** Offer "Keep it with me" (creating a drive); reassigning needs a real HR. */
  allowSelf?: boolean;
  /** The current owner, left out of the list when reassigning. */
  exclude?: string | null;
}

/**
 * "Who runs this drive?" for a Super Admin. HR only see drives they own, so this decides
 * whose portal the drive appears in.
 */
export function OwnerSelect({ value, onChange, error, allowSelf = false, exclude }: OwnerSelectProps) {
  const owners = useAsync(listHrOwners, []);
  const list = (owners.data ?? []).filter((o) => o.id !== exclude);
  const hint = owners.error
    ? `Couldn't load HR users: ${owners.error.message}`
    : owners.data && list.length === 0
      ? "No active HR users yet. Invite one from Users & roles."
      : "The drive shows up in this person's HR portal. Only they (and Super Admins) can see it.";
  return (
    <Field label="Who runs this drive?" required error={error} hint={hint}>
      <Select value={value} disabled={owners.loading && !owners.data} onChange={(e) => onChange(e.target.value, e.target.selectedOptions[0]?.text ?? "")}>
        <option value="" disabled>
          {owners.loading && !owners.data ? "Loading HR users…" : "Choose an HR"}
        </option>
        {list.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.email})
          </option>
        ))}
        {allowSelf && <option value={KEEP_WITH_ME}>Keep it with me (no HR will see it)</option>}
      </Select>
    </Field>
  );
}
