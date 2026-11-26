import { useEffect, useId, useRef, type ReactNode } from "react";
import { strings } from "@/pages/resolver/i18n";
import { Button } from "./Button";

export interface DialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
}

/** A modal confirmation dialog on <dialog>: the browser provides the focus trap and Escape. */
export function Dialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  danger,
  busy,
  onConfirm,
  onClose,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    } else if (!open && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" aria-labelledby={titleId} onClose={onClose} onCancel={onClose}>
      {open && (
        <>
          <h2 id={titleId}>{title}</h2>
          {children}
          <div className="dialog__actions">
            <Button variant="secondary" onClick={onClose}>
              {cancelLabel ?? strings.common.cancel}
            </Button>
            {onConfirm && (
              <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} busy={busy}>
                {confirmLabel ?? strings.common.confirm}
              </Button>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
