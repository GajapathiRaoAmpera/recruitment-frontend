"use client";

import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import s from "./dialog.module.scss";

export const Dialog = RD.Root;
export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;

interface DialogContentProps {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Render as a right-hand side panel instead of a centred dialog. */
  side?: boolean;
  /** Where focus goes on close when the dialog has no Trigger (call preventDefault, then focus). */
  onCloseAutoFocus?: (e: Event) => void;
}

/** Shared backdrop for dialogs, drawers and alert dialogs. */
export const overlayClasses = s.overlay;
export const dialogStyles = s;

export function DialogContent({ title, description, children, footer, className, side, onCloseAutoFocus }: DialogContentProps) {
  return (
    <RD.Portal>
      <RD.Overlay className={s.overlay} />
      <RD.Content
        className={cn(s.content, side ? s.side : s.centered, className)}
        onCloseAutoFocus={onCloseAutoFocus}
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <div className={s.header}>
          <div>
            <RD.Title className={s.title}>{title}</RD.Title>
            {description && <RD.Description className={s.description}>{description}</RD.Description>}
          </div>
          <RD.Close aria-label="Close" className={s.close}>
            <X aria-hidden size={16} />
          </RD.Close>
        </div>
        <div className={s.body}>{children}</div>
        {footer && <div className={s.footer}>{footer}</div>}
      </RD.Content>
    </RD.Portal>
  );
}
