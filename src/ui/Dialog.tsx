import { useEffect, useRef, type ReactNode } from 'react';
import './Dialog.css';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Native <dialog>: focus trap, Esc and backdrop come for free.
export default function Dialog({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <>
          <h2 id="dialog-title" className="dialog__title">
            {title}
          </h2>
          {children}
        </>
      )}
    </dialog>
  );
}
