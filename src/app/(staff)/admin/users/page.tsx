"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { hire as h, Person } from "@/components/hire/ui";
import { useStaffUsers } from "@/features/admin/use-staff-users";
import { useStore } from "@/mock/store";
import type { StaffRole } from "@/mock/types";

export default function UsersPage() {
  useBreadcrumbs([{ label: "Users & roles" }]);
  const { state } = useStore();
  const { real, users, loadError, invite, toggle } = useStaffUsers();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", title: "", role: "HR" as StaffRole });
  const [error, setError] = useState<string>();

  const add = async () => {
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) return setError("Enter a name and a valid email.");
    if (users?.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())) return setError("A user with this email already exists.");
    setSaving(true);
    const err = await invite(form);
    setSaving(false);
    if (err) return setError(err);
    toast({ tone: "success", title: "Invite sent", description: `${form.email} will get an email to set their password.` });
    setOpen(false);
    setForm({ name: "", email: "", title: "", role: "HR" });
  };

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Staff accounts. Students don't have accounts — they sign in per round with Student ID and date of birth."
        actions={
          <Button onClick={() => { setError(undefined); setOpen(true); }}>
            <Plus aria-hidden size={16} style={{ marginRight: 4 }} /> Invite user
          </Button>
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>User</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Last sign-in</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {!users && !loadError && (
            <tr>
              <Td colSpan={5}>
                <LoadingLabel label="Loading users" />
                <Skeleton style={{ height: 40 }} />
              </Td>
            </tr>
          )}
          {loadError && (
            <tr>
              <Td colSpan={5}>
                <p role="alert" className={h.small} style={{ color: "var(--ui-color-danger)" }}>
                  Couldn&apos;t load users: {loadError} Refresh the page to try again.
                </p>
              </Td>
            </tr>
          )}
          {users?.map((u) => (
            <tr key={u.id}>
              <Td>
                <Person name={u.name} meta={real ? u.email : `${u.email} · ${u.title}`} />
              </Td>
              <Td>
                <Badge tone={u.role === "SUPER_ADMIN" ? "primary" : "neutral"}>{u.role === "SUPER_ADMIN" ? "Super Admin" : "HR"}</Badge>
              </Td>
              <Td>
                <Badge tone={u.active ? "success" : "danger"}>{u.active ? "Active" : "Inactive"}</Badge>
              </Td>
              <Td className={h.small}>{u.lastLogin}</Td>
              <Td>
                {u.id !== state.session?.userId && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const err = await toggle(u);
                      if (err) toast({ tone: "danger", title: `Couldn't ${u.active ? "deactivate" : "activate"} ${u.name}`, description: err });
                    }}
                  >
                    {u.active ? "Deactivate" : "Activate"}
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Invite user"
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={add} loading={saving}>
                Send invite
              </Button>
            </>
          }
        >
          <div className={h.stackSm}>
            {error && (
              <p role="alert" className={h.small} style={{ color: "var(--ui-color-danger)" }}>
                {error}
              </p>
            )}
            <Field label="Full name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Work email" required>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            {!real && (
              <Field label="Job title">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
            )}
            <Field label="Role">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>
                <option value="HR">HR — runs drives</option>
                <option value="SUPER_ADMIN">Super Admin — everything + system settings</option>
              </Select>
            </Field>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
