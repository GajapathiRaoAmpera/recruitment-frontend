"use client";

import * as AD from "@radix-ui/react-alert-dialog";
import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { dialogStyles as s } from "./dialog";
import { Field } from "./field";
import { Input } from "./input";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  /** When set, the user must type this exact text before confirming. */
  typeToConfirm?: string;
  destructive?: boolean;
  loading?: boolean;
  error?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  typeToConfirm,
  destructive = true,
  loading,
  error,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const blocked = typeToConfirm !== undefined && typed !== typeToConfirm;

  return (
    <AD.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped("");
        onOpenChange(o);
      }}
    >
      <AD.Portal>
        <AD.Overlay className={s.overlay} />
        <AD.Content className={s.alert}>
          <AD.Title className={s.title}>{title}</AD.Title>
          <AD.Description className={s.alertDescription}>{description}</AD.Description>
          {typeToConfirm !== undefined && (
            <Field className={s.confirmField} label={`Type ${typeToConfirm} to confirm`}>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </Field>
          )}
          {error && (
            <p role="alert" className={s.alertError}>
              {error}
            </p>
          )}
          <div className={s.alertActions}>
            <AD.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AD.Cancel>
            <Button
              variant={destructive ? "danger" : "primary"}
              disabled={blocked}
              loading={loading}
              onClick={() => void onConfirm()}
            >
              {confirmLabel}
            </Button>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
