import { Icon } from "./Icon";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
export function Dialog({
  title,
  description,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="dialog-heading">
        <div>
          <h2 id="dialog-title">{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Tutup dialog"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
