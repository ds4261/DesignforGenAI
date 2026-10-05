"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DraftPublisher({ id, captions }: { id: string; captions: string[] }) {
  const [selected, setSelected] = useState<number[]>([0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function publish() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/media/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedIndices: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save captions.");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save captions.");
    } finally { setBusy(false); }
  }
  return (
    <fieldset className="mt-4 flex flex-col gap-3" disabled={busy}>
      <legend className="font-semibold">Private draft — choose captions to share</legend>
      {captions.map((caption, index) => (
        <label key={index} className="flex items-start gap-3">
          <input type="checkbox" className="mt-1" checked={selected.includes(index)}
            onChange={() => setSelected((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])} />
          <span>{caption}</span>
        </label>
      ))}
      <button type="button" onClick={publish} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {busy ? "Saving…" : "Save for voting"}
      </button>
      {error && <p role="alert" className="text-red-600">{error}</p>}
    </fieldset>
  );
}
