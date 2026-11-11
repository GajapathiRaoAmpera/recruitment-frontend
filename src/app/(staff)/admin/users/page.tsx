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
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { hire as h, Person } from "@/components/hire/ui";
import { useStore } from "@/mock/store";
import type { StaffRole } from "@/mock/types";

export default function UsersPage() {
  useBreadcrumbs([{ label: "Users & roles" }]);
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", title: "", role: "HR" as StaffRole });
  const [error, setError] = useState<string>();

  const add = () => {
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) return setError("Enter a name and a valid email.");
    if (state.staff.some((u) => u.email.toLowerCase() === form.email.toLowerCase())) return setError("A user with this email already exists.");
    dispatch({ type: "addUser", user: form });
    toast({ tone: "success", title: "Invite sent", description: form.email });
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
          {state.staff.map((u) => (
            <tr key={u.id}>
              <Td>
                <Person name={u.name} meta={`${u.email} · ${u.title}`} />
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
                  <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "toggleUser", id: u.id })}>
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
              <Button onClick={add}>Send invite</Button>
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
            <Field label="Job title">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
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
