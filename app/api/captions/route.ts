import { createClient } from "@/lib/supabase-server";
import { photoError } from "@/lib/caption-upload";
import { CAPTION_SYSTEM_PROMPT, CAPTION_USER_PROMPT } from "@/lib/caption-prompts";

export const runtime = "nodejs";

type ModelResponse = {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in to create captions." }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: "Upload a photo to continue." }, { status: 400 }); }
  const photo = form.get("photo");
  if (!(photo instanceof File)) return Response.json({ error: "Choose a photo first." }, { status: 400 });
  const invalid = photoError(photo);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "Caption generation is not set up yet. Please try again later." }, { status: 503 });

  try {
    const image = Buffer.from(await photo.arrayBuffer()).toString("base64");
    const model = process.env.GEMINI_CAPTION_MODEL || "gemini-3.5-flash-lite";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CAPTION_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [
          { text: CAPTION_USER_PROMPT },
          { inlineData: { mimeType: photo.type, data: image } },
        ] }],
        generationConfig: {
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingLevel: "low" },
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object", additionalProperties: false,
            properties: { captions: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } } },
            required: ["captions"],
          },
        },
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      const serviceDisabled = failure?.error?.details?.some((detail: { reason?: string }) => detail.reason === "SERVICE_DISABLED");
      if (serviceDisabled) {
        return Response.json({ error: "The Gemini API is disabled for this project. The site owner needs to enable it in Google Cloud Console." }, { status: 503 });
      }
      const invalidKey = failure?.error?.details?.some((detail: { reason?: string }) => detail.reason === "API_KEY_INVALID");
      if (response.status === 401 || invalidKey) {
        return Response.json({ error: "Caption generation has an invalid Gemini API key. The site owner needs to update it." }, { status: 503 });
      }
      if (response.status === 429) {
        return Response.json({ error: "Gemini's request quota has been reached. Please try again later; the site owner can check the free-tier limits in Google AI Studio." }, { status: 429 });
      }
      if (response.status === 404 || response.status === 403) {
        return Response.json({ error: "Caption generation cannot access its AI model. The site owner needs to check the API configuration." }, { status: 503 });
      }
      if (response.status === 400) {
        return Response.json({ error: "The AI service could not process this photo. Try another JPG, PNG, or WebP image." }, { status: 422 });
      }
      if (response.status === 503) {
        return Response.json({ error: "Gemini is temporarily overloaded. Please try generating captions again in a minute." }, { status: 503 });
      }
      return Response.json({ error: "Caption generation is unavailable right now. Please try again shortly." }, { status: 502 });
    }
    const result: ModelResponse = await response.json();
    const candidate = result.candidates?.[0];
    if (result.promptFeedback?.blockReason || candidate?.finishReason === "SAFETY") {
      return Response.json({ error: "Gemini could not caption this photo. Please choose another photo." }, { status: 422 });
    }
    const text = candidate?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("");
    if (candidate?.finishReason !== "STOP" || !text) throw new Error("No completed captions");
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.captions) || parsed.captions.length !== 3 ||
        !parsed.captions.every((caption: unknown) => typeof caption === "string" && caption.trim().length > 0)) {
      throw new Error("Invalid captions");
    }
    const id = crypto.randomUUID();
    const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[photo.type];
    const path = `${user.id}/${id}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("nyc-caption-photos")
      .upload(path, photo, { contentType: photo.type });
    if (uploadError) {
      return Response.json({ error: "Captions were generated, but the photo could not be saved. Please check the caption storage setup and try again." }, { status: 503 });
    }
    const { error: saveError } = await supabase.from("nyc_caption_media").insert({
      id, user_id: user.id, photo_path: path, captions: parsed.captions,
      selected_index: 0, system_prompt: CAPTION_SYSTEM_PROMPT,
      user_prompt: CAPTION_USER_PROMPT, model,
    });
    if (saveError) {
      await supabase.storage.from("nyc-caption-photos").remove([path]);
      return Response.json({ error: "The generated captions could not be saved. Please check the caption database setup and try again." }, { status: 503 });
    }
    return Response.json({ captions: parsed.captions, mediaId: id });
  } catch {
    return Response.json({ error: "Could not generate captions for this photo. Please try again." }, { status: 502 });
  }
}
