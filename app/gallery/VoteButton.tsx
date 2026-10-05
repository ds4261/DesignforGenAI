"use client";

import { useState } from "react";

export default function VoteButton({ id, captionIndex, initialHearts, initialDownvotes, initialReaction }: {
  id: string; captionIndex: number; initialHearts: number; initialDownvotes: number; initialReaction: number;
}) {
  const [hearts, setHearts] = useState(initialHearts);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [reaction, setReaction] = useState(initialReaction);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle(direction: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/media/${id}/vote`, {
        method: reaction === direction ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captionIndex, direction }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your reaction.");
      setHearts(data.hearts);
      setDownvotes(data.downvotes);
      setReaction(data.reaction);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save your reaction.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-4">
      <div className="flex gap-3">
        <button type="button" aria-pressed={reaction === 1} disabled={busy} onClick={() => toggle(1)}
          aria-label={reaction === 1 ? "Remove heart" : "Heart this caption"}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 transition-colors disabled:opacity-50 ${reaction === 1 ? "border-rose-300 bg-rose-50 text-rose-600" : "border-gray-300 text-gray-500 hover:text-rose-600"}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill={reaction === 1 ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
          <span aria-hidden="true">{hearts}</span>
        </button>
        <button type="button" aria-pressed={reaction === -1} disabled={busy} onClick={() => toggle(-1)}
          aria-label={reaction === -1 ? "Remove downvote" : "Downvote this caption"}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 transition-colors disabled:opacity-50 ${reaction === -1 ? "border-slate-400 bg-slate-100 text-slate-800" : "border-gray-300 text-gray-500 hover:text-slate-800"}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill={reaction === -1 ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3h4v11h-4zM17 12l-5 9a3 3 0 0 1-2-3l1-4H5a2 2 0 0 1-2-2l2-7a2 2 0 0 1 2-2h10" />
          </svg>
          <span aria-hidden="true">{downvotes}</span>
        </button>
      </div>
      <span className="sr-only" aria-live="polite">{hearts} hearts, {downvotes} downvotes{busy ? ", saving" : ""}</span>
      {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
    </div>
  );
}
