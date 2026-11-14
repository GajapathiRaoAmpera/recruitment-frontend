"use client";

import { Copy, Mail, Link2, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { ErrorState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { hire as h, Person } from "@/components/hire/ui";
import { useStaffUsers } from "@/features/admin/use-staff-users";
import { useStore } from "@/mock/store";
import type { StaffRole, StaffUser } from "@/mock/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_LABEL: Record<StaffRole, string> = { HR: "HR", SUPER_ADMIN: "Super Admin" };
const EMPTY_FORM = { name: "", email: "", title: "", role: "HR" as StaffRole };
type FieldErrors = Partial<Record<"name" | "email", string>>;

export function UsersScreen() {
  useBreadcrumbs([{ label: "Users & roles" }]);
  const { state } = useStore();
  const { real, users, loadError, reload, invite, update, remove } = useStaffUsers();
  const toast = useToast();

  // Invite
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [inviteError, setInviteError] = useState<string>();
  const [emailFailed, setEmailFailed] = useState(false); // only then offer the copy-link fallback
  const [inviting, setInviting] = useState<"email" | "link">();
  const [link, setLink] = useState<{ email: string; url: string }>();
  const [copied, setCopied] = useState(false);

  // Edit
  const [editing, setEditing] = useState<StaffUser>();
  const [edit, setEdit] = useState({ name: "", role: "HR" as StaffRole });
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editError, setEditError] = useState<string>();
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmPromote, setConfirmPromote] = useState(false);

  // Row actions
  const [deactivating, setDeactivating] = useState<StaffUser>();
  const [deleting, setDeleting] = useState<StaffUser>();
  const [rowError, setRowError] = useState<string>();
  const [busyRow, setBusyRow] = useState<string>();

  if (loadError) return <ErrorState message={`Couldn't load users: ${loadError}`} onRetry={reload} />;
  if (!users) return <RocketLoader label="Loading users" />;

  const validate = (name: string, email?: string): FieldErrors => {
    const e: FieldErrors = {};
    if (!name.trim()) e.name = "Enter their full name.";
    if (email !== undefined) {
      const em = email.trim().toLowerCase();
      if (!EMAIL.test(em)) e.email = "Enter a valid work email, like name@ampera.tech.";
      else if (users.some((u) => u.email.toLowerCase() === em)) e.email = "Someone already has an account with this email.";
    }
    return e;
  };

  const openInvite = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setInviteError(undefined);
    setEmailFailed(false);
    setOpen(true);
  };

  const add = async (sendEmail: boolean) => {
    const e = validate(form.name, form.email);
    setFormErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#invite-form [aria-invalid="true"]')?.focus());
      return;
    }
    setInviting(sendEmail ? "email" : "link");
    setInviteError(undefined);
    const res = await invite({ ...form, name: form.name.trim(), email: form.email.trim() }, sendEmail);
    setInviting(undefined);
    if (res.error) {
      setEmailFailed(sendEmail);
      return setInviteError(res.error);
    }
    if (res.link) {
      setCopied(false);
      setLink({ email: form.email.trim(), url: res.link });
    } else {
      toast({ tone: "success", title: "Invite sent", description: `${form.email.trim()} will get an email to set their password.` });
    }
    setOpen(false);
  };
  const submitInvite = (e: FormEvent) => {
    e.preventDefault();
    void add(true);
  };

  const openEdit = (u: StaffUser) => {
    setEdit({ name: u.name, role: u.role });
    setEditErrors({});
    setEditError(undefined);
    setEditing(u);
  };
  const editChanged = editing !== undefined && (edit.name.trim() !== editing.name || edit.role !== editing.role);
  const saveEdit = async (promoteOk = false) => {
    if (!editing) return;
    const e = validate(edit.name);
    setEditErrors(e);
    if (Object.keys(e).length) return;
    // Super Admin is a big grant: ask once more before saving it.
    if (edit.role === "SUPER_ADMIN" && editing.role !== "SUPER_ADMIN" && !promoteOk) return setConfirmPromote(true);
    setConfirmPromote(false);
    setSavingEdit(true);
    const err = await update(editing, { name: edit.name.trim(), role: edit.role });
    setSavingEdit(false);
    if (err) return setEditError(err);
    toast({ tone: "success", title: "User updated", description: edit.name.trim() });
    setEditing(undefined);
  };

  const setActive = async (u: StaffUser, active: boolean) => {
    setBusyRow(u.id);
    setRowError(undefined);
    const err = await update(u, { active });
    setBusyRow(undefined);
    if (err) {
      if (!active) return setRowError(err); // shown inside the open confirm
      return toast({ tone: "danger", title: `Couldn't activate ${u.name}`, description: err });
    }
    setDeactivating(undefined);
    toast({ tone: "success", title: active ? `${u.name} can sign in again` : `${u.name} is deactivated`, description: active ? undefined : "They can't sign in until you activate them." });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyRow(deleting.id);
    const err = await remove(deleting);
    setBusyRow(undefined);
    if (err) return setRowError(err);
    toast({ tone: "success", title: "User deleted", description: deleting.email });
    setDeleting(undefined);
  };

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Staff accounts. Students don't have accounts — they sign in per round with Student ID and date of birth."
        actions={
          <Button onClick={openInvite}>
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
          {users.map((u) => (
            <tr key={u.id}>
              <Td>
                <Person name={u.name} meta={real ? u.email : `${u.email} · ${u.title}`} />
              </Td>
              <Td>
                <Badge tone={u.role === "SUPER_ADMIN" ? "primary" : "neutral"}>{ROLE_LABEL[u.role]}</Badge>
              </Td>
              <Td>
                <Badge tone={u.active ? "success" : "danger"}>{u.active ? "Active" : "Inactive"}</Badge>
              </Td>
              <Td className={h.small}>{u.lastLogin}</Td>
              <Td>
                {/* Own row: no actions, so nobody can lock themselves out (the API refuses too). */}
                {u.id === state.session?.userId ? (
                  <span className={h.xs}>You</span>
                ) : (
                  <div className={h.row}>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(u)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyRow === u.id && u.active === false}
                      disabled={busyRow === u.id}
                      onClick={() => {
                        setRowError(undefined);
                        if (u.active) setDeactivating(u);
                        else void setActive(u, true);
                      }}
                    >
                      {u.active ? "Deactivate" : "Activate"}
                    </Button>
                    {/* Super Admins are deactivate-only (API: SUPER_ADMIN_PROTECTED). */}
                    {u.role !== "SUPER_ADMIN" && (
                      <Button
                        size="sm"
                        variant="tertiary"
                        onClick={() => {
                          setRowError(undefined);
                          setDeleting(u);
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Dialog open={open} onOpenChange={(o) => !inviting && setOpen(o)}>
        <DialogContent
          title="Invite user"
          description="They get a link to set their own password."
          footer={
            <>
              <Button variant="secondary" disabled={inviting !== undefined} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="invite-form" loading={inviting === "email"} disabled={inviting !== undefined}>
                <Mail aria-hidden size={16} style={{ marginRight: 4 }} /> Send invite email
              </Button>
            </>
          }
        >
          <form id="invite-form" className={h.stackSm} onSubmit={submitInvite} noValidate>
            {inviteError && (
              <p role="alert" className={h.small} style={{ color: "var(--ui-color-danger)" }}>
                Couldn&apos;t create the account: {inviteError}
              </p>
            )}
            {emailFailed && (
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                loading={inviting === "link"}
                disabled={inviting !== undefined}
                onClick={() => add(false)}
              >
                <Link2 aria-hidden size={16} style={{ marginRight: 4 }} /> Create a link to share instead
              </Button>
            )}
            <Field label="Full name" required error={formErrors.name}>
              <Input
                autoComplete="name"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  setFormErrors((x) => ({ ...x, name: undefined }));
                }}
              />
            </Field>
            <Field label="Work email" required error={formErrors.email}>
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  setFormErrors((x) => ({ ...x, email: undefined }));
                }}
                onBlur={() => form.email.trim() && setFormErrors((x) => ({ ...x, email: validate("x", form.email).email }))}
              />
            </Field>
            {!real && (
              <Field label="Job title">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
            )}
            <Field label="Role" hint={form.role === "SUPER_ADMIN" ? "Super Admins can manage users, AI settings and every drive." : "HR runs campus drives."}>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>
                <option value="HR">HR</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </Select>
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={link !== undefined} onOpenChange={(o) => !o && setLink(undefined)}>
        <DialogContent
          title="Share this invite link"
          footer={
            <Button variant="secondary" onClick={() => setLink(undefined)}>
              Done
            </Button>
          }
        >
          <div className={h.stackSm}>
            <p className={h.small}>
              Account created for <strong>{link?.email}</strong>. Send them this link privately (Slack, WhatsApp). It opens the page where they set their
              password, works once and expires in 24 hours. Anyone with the link can claim the account, so don&apos;t post it in a shared channel.
            </p>
            <Field label="Invite link">
              <Input value={link?.url ?? ""} readOnly onFocus={(e) => e.currentTarget.select()} />
            </Field>
            <div>
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link!.url);
                    setCopied(true);
                  } catch {
                    toast({ tone: "danger", title: "Couldn't copy automatically", description: "Select the link above and copy it with Ctrl+C." });
                  }
                }}
              >
                <Copy aria-hidden size={16} style={{ marginRight: 4 }} /> {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && !savingEdit && setEditing(undefined)}>
        <DialogContent
          title={`Edit ${editing?.name ?? "user"}`}
          footer={
            <>
              <Button variant="secondary" disabled={savingEdit} onClick={() => setEditing(undefined)}>
                Cancel
              </Button>
              <Button type="submit" form="edit-form" loading={savingEdit} disabled={!editChanged}>
                Save changes
              </Button>
            </>
          }
        >
          <form
            id="edit-form"
            className={h.stackSm}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void saveEdit();
            }}
          >
            {editError && (
              <p role="alert" className={h.small} style={{ color: "var(--ui-color-danger)" }}>
                Couldn&apos;t save: {editError}
              </p>
            )}
            <Field label="Full name" required error={editErrors.name}>
              <Input
                value={edit.name}
                onChange={(e) => {
                  setEdit({ ...edit, name: e.target.value });
                  setEditErrors({});
                }}
              />
            </Field>
            <Field label="Work email" hint="Email can't be changed here; it's their sign-in.">
              <Input value={editing?.email ?? ""} disabled />
            </Field>
            <Field label="Role">
              <Select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as StaffRole })}>
                <option value="HR">HR</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </Select>
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmPromote}
        onOpenChange={setConfirmPromote}
        destructive={false}
        title={`Make ${editing?.name ?? "this user"} a Super Admin?`}
        description="They will be able to manage every user (including you), AI settings and all drives."
        confirmLabel="Make Super Admin"
        loading={savingEdit}
        onConfirm={() => saveEdit(true)}
      />

      <ConfirmDialog
        open={deactivating !== undefined}
        onOpenChange={(o) => !o && busyRow === undefined && setDeactivating(undefined)}
        title={`Deactivate ${deactivating?.name ?? "user"}?`}
        description={`${deactivating?.email ?? "They"} won't be able to sign in until you activate them again. Their drives and history stay.`}
        confirmLabel="Deactivate"
        loading={busyRow !== undefined && busyRow === deactivating?.id}
        error={rowError}
        onConfirm={() => deactivating && setActive(deactivating, false)}
      />

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(o) => !o && busyRow === undefined && setDeleting(undefined)}
        title={`Delete ${deleting?.name ?? "user"}?`}
        description={
          <>
            {deleting?.email} loses access and their account is removed. Users who own drives or have activity history can&apos;t be deleted — deactivate them
            instead so the audit trail stays complete.
          </>
        }
        confirmLabel={`Delete ${deleting?.name ?? "user"}`}
        onConfirm={confirmDelete}
        loading={busyRow !== undefined && busyRow === deleting?.id}
        error={rowError}
      />
    </>
  );
}
