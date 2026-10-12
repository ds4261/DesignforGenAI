"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteCaptionButton({ id, captionIndex }: { id: string; captionIndex: number | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const router = useRouter();
  const draft = captionIndex === null;

  function close() {
    dialog.current?.close();
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/media/${id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captionIndex }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete this caption.");
      if (data.warning) {
        setWarning(data.warning);
      } else {
        dialog.current?.close();
        router.refresh();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete this caption.");
    } finally { setBusy(false); }
  }

  return (
    <div className="shrink-0">
      <button type="button" aria-label={draft ? "Delete draft" : "Delete caption"}
        title={draft ? "Delete draft" : "Delete caption"}
        onClick={() => { setError(""); setWarning(""); dialog.current?.showModal(); }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border delete-icon transition-colors">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7M14 10v7" />
        </svg>
      </button>
      <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
        onCancel={(event) => { if (busy) event.preventDefault(); }}
        onClose={() => { if (warning) router.refresh(); }}
        className="fixed inset-0 m-auto w-[calc(100%-3rem)] max-w-md rounded-2xl border delete-dialog p-6 shadow-2xl backdrop:bg-black/40">
        <h2 id={titleId} className="text-xl font-semibold">{warning ? "Caption deleted" : draft ? "Delete this draft?" : "Delete this caption?"}</h2>
        <p id={descriptionId} className="mt-3 text-sm leading-6 palette-muted">
          {warning || (draft
            ? "This will delete the private draft, its photo, and all generated captions. This cannot be undone."
            : "This caption and its votes will be removed from My captions and the gallery. Other saved captions will stay. If this is the last caption, its photo will also be deleted. This cannot be undone.")}
        </p>
        {error && <p role="alert" className="mt-3 text-sm palette-error">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" autoFocus disabled={busy} onClick={close}
            className="rounded-xl button-secondary px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {warning ? "Done" : "Cancel"}
          </button>
          {!warning && <button type="button" disabled={busy} onClick={remove}
            className="rounded-xl delete-confirm px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy ? "Deleting…" : "Delete"}
          </button>}
        </div>
      </dialog>
    </div>
  );
}
