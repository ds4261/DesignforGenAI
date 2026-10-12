"use client";

import { useEffect, useState, type FormEvent } from "react";
import { photoError } from "@/lib/caption-upload";
import Link from "next/link";
import Easel from "./Easel";

export default function CaptionForm() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [captions, setCaptions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mediaId, setMediaId] = useState("");
  const [selected, setSelected] = useState<number[]>([0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo || busy || saving) return;
    setBusy(true);
    setError("");
    setCaptions([]);
    setMediaId("");
    setSaved(false);
    setSelected([0]);
    try {
      const form = new FormData();
      form.append("photo", photo);
      const response = await fetch("/api/captions", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate captions. Try again.");
      setCaptions(data.captions);
      setMediaId(data.mediaId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally { setBusy(false); }
  }

  async function save() {
    if (!mediaId || saving || saved) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/media/${mediaId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedIndices: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your caption.");
      setSaved(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save your caption.");
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={generate} className={`caption-easel-form flex flex-col gap-3 ${captions.length ? "easel-results" : "easel-upload"}`} aria-busy={busy}>
      {captions.length === 0 && <>
      <p>Upload a photo and get three playful NYC-inspired captions to choose from.</p>
      <Easel><div className="polaroid">
        <label className={`polaroid-photo ${busy || saving ? "polaroid-disabled" : ""}`}>
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || saving}
            aria-label={preview ? "Change photo" : "Choose file"}
            aria-describedby="photo-upload-details"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (!file) return;
              const message = photoError(file);
              setError(message ?? "");
              setCaptions([]);
              setMediaId("");
              setSaved(false);
              setSelected([0]);
              setPhoto(message ? null : file);
              setPreview(!message ? URL.createObjectURL(file) : "");
            }} className="polaroid-input" />
          {preview ? (
            // A local blob URL fills the Polaroid before upload.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Selected photo" className="polaroid-preview" />
          ) : (
            <span className="polaroid-placeholder">
              <svg aria-hidden="true" viewBox="0 0 48 48" fill="none" className="h-14 w-14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="8" width="36" height="32" rx="4" />
                <circle cx="17" cy="19" r="4" />
                <path d="m7 34 10-9 8 7 8-12 9 14" />
              </svg>
              <span>Choose file</span>
              <span className="polaroid-hint">A little moment, ready for its caption.</span>
            </span>
          )}
          {preview && <span className="polaroid-change">Change photo</span>}
        </label>
        <button type="submit" disabled={!photo || busy || saving} className="polaroid-generate">
          {busy ? "Writing your captions…" : "Generate captions"}
          <span aria-hidden="true">{busy ? "…" : "↗"}</span>
        </button>
      </div></Easel>
      <p id="photo-upload-details" className="text-sm palette-muted">JPG, PNG, or WebP, up to 4 MB. Your photo is sent to Google Gemini. Generated captions and their prompts are saved privately until you share a caption for voting.</p>
      </>}
      {error && <p role="alert" className="palette-error">{error}</p>}
      <section aria-live="polite" aria-label="Generated captions">
        {captions.length > 0 && <>
          <h2 className="text-xl font-semibold mb-2">Pick your favorites</h2>
          <p className="mb-5 text-sm palette-muted">Select one or more Polaroids to share. If none are selected, the first caption will be saved.</p>
          <fieldset className="city-caption-results" disabled={saving || saved}>
            <legend className="sr-only">Choose captions to share</legend>
            <div className="polaroid-options">
              {captions.map((caption, index) => (
                <Easel key={index}><label className={`caption-polaroid ${selected.includes(index) ? "caption-polaroid-selected" : ""}`}>
                  <input type="checkbox" name="caption" value={index} checked={selected.includes(index)}
                    onChange={() => setSelected((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])} className="polaroid-checkbox" />
                  {preview && (
                    // Each local photo preview is paired with a different caption.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt={`Your photo with caption option ${index + 1}`} className="caption-polaroid-photo" />
                  )}
                  <span className="caption-polaroid-text">{caption}</span>
                  <span className="polaroid-selection">{selected.includes(index) ? "✓ Selected" : "Select this caption"}</span>
                </label></Easel>
              ))}
            </div>
          </fieldset>
        </>}
        {mediaId && !saved && <button type="button" onClick={save} disabled={saving}
          className="button-primary mt-4 disabled:opacity-50">
          {saving ? "Saving…" : "Save for voting"}
        </button>}
        {saved && <p role="status" className="mt-4">Saved! <Link href="/gallery" className="font-semibold underline">View the voting gallery</Link></p>}
        {captions.length > 0 && <button type="button" disabled={saving} className="button-secondary mt-5 disabled:opacity-50"
          onClick={() => {
            setCaptions([]);
            setMediaId("");
            setPhoto(null);
            setPreview("");
            setSelected([0]);
            setSaved(false);
            setError("");
          }}>Create with another photo</button>}
      </section>
    </form>
  );
}
