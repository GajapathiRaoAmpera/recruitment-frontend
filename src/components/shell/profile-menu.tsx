"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { loginPath, portalOf } from "@/mock/auth";
import { useStore } from "@/mock/store";
import type { StaffUser } from "@/mock/types";
import s from "./shell.module.scss";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function ProfileMenu({ user }: { user: StaffUser }) {
  const router = useRouter();
  const { dispatch } = useStore();

  return (
    <DM.Root>
      <DM.Trigger aria-label={`Account menu for ${user.name}`} className={s.trigger}>
        <span aria-hidden className={s.avatar}>
          {initials(user.name)}
        </span>
        <span className={s.triggerName}>{user.name}</span>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} className={s.menu}>
          <div className={s.menuHead}>
            <p className={s.menuName}>{user.name}</p>
            <p className={s.menuEmail}>{user.email}</p>
            <div className={s.menuRole}>
              <Badge tone={user.role === "SUPER_ADMIN" ? "primary" : "neutral"}>{user.role === "SUPER_ADMIN" ? "Super Admin" : "HR"}</Badge>
            </div>
          </div>
          <DM.Separator className={s.separator} />
          <DM.Item
            className={s.item}
            onSelect={() => {
              void supabase?.auth.signOut();
              dispatch({ type: "logout" });
              router.replace(loginPath[portalOf(user.role)]);
            }}
          >
            <LogOut aria-hidden size={16} /> Sign out
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
