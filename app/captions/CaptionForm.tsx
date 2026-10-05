"use client";

import { useEffect, useState, type FormEvent } from "react";
import { photoError } from "@/lib/caption-upload";
import Link from "next/link";

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
    <form onSubmit={generate} className="flex flex-col gap-5" aria-busy={busy}>
      <p>Upload a photo and get three playful NYC-inspired captions to choose from.</p>
      <label className="flex flex-col gap-2 font-medium">
        Choose a photo
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || saving}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            const message = file ? photoError(file) : null;
            setError(message ?? "");
            setCaptions([]);
            setMediaId("");
            setSaved(false);
            setSelected([0]);
            setPhoto(message ? null : file);
            setPreview(file && !message ? URL.createObjectURL(file) : "");
          }} className="rounded-xl border p-4" />
      </label>
      <p className="text-sm text-gray-500">JPG, PNG, or WebP, up to 4 MB. Your photo is sent to Google Gemini. Generated captions and their prompts are saved privately until you share a caption for voting.</p>
      {preview && (
        // A local blob URL previews the selected file before upload.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Selected photo" className="max-h-96 w-full rounded-2xl object-contain" />
      )}
      <button type="submit" disabled={!photo || busy || saving}
        className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
        {busy ? "Writing your captions…" : "Generate captions"}
      </button>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <section aria-live="polite" aria-label="Generated captions">
        {captions.length > 0 && <h2 className="text-xl font-semibold mb-3">Choose captions</h2>}
        {captions.length > 0 && <p className="mb-3">The first caption is selected by default. Select one or more captions to share for voting.</p>}
        <ul className="flex flex-col gap-3" aria-label="Caption choices">
          {captions.map((caption, index) => (
            <li key={index} className="rounded-2xl bg-gradient-to-r from-sky-100 to-green-100 p-5 text-gray-900">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" name="caption" value={index} checked={selected.includes(index)}
                  onChange={() => setSelected((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])} disabled={saving || saved} className="mt-1" />
                <span>{caption}</span>
              </label>
            </li>
          ))}
        </ul>
        {mediaId && !saved && <button type="button" onClick={save} disabled={saving}
          className="mt-4 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white disabled:opacity-50">
          {saving ? "Saving…" : "Save for voting"}
        </button>}
        {saved && <p role="status" className="mt-4">Saved! <Link href="/gallery" className="font-semibold underline">View the voting gallery</Link></p>}
      </section>
    </form>
  );
}
