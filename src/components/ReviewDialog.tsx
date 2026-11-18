"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export default function ReviewDialog({ title, children, onClose, busy = false, className = "" }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} className={`card enrollment-review-dialog ${className}`} aria-labelledby={titleId} onCancel={(event) => {
      event.preventDefault();
      if (!busy) onClose();
    }}>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
