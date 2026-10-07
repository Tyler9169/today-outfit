import { z } from "zod";
import { recognitionSchema } from "./recognition-schema";

import { labelSchema } from "./clothing-features";

async function requestPhoto(image: HTMLImageElement, signal: AbortSignal, mode: "garment" | "label") {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法处理照片，请手动填写类别和颜色。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const requestController = new AbortController();
  const cancel = () => requestController.abort();
  if (signal.aborted) cancel();
  else signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 55_000);
  try {
  const response = await fetch("/api/recognize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, image: canvas.toDataURL("image/jpeg", 0.85) }),
    signal: requestController.signal,
  });
  const body = await response.json();
  if (!response.ok) {
    const failure = z.object({ error: z.string() }).safeParse(body);
    throw new Error(failure.success ? failure.data.error : "识别失败，请重试或手动填写。");
  }
  return body;
  } catch (error) {
    if (requestController.signal.aborted && !signal.aborted) throw new Error("识别超时，请重试或手动录入。");
    throw error;
  } finally { clearTimeout(timeout); signal.removeEventListener("abort", cancel); }
}

export async function recognizePhoto(image: HTMLImageElement, signal: AbortSignal) { return recognitionSchema.parse(await requestPhoto(image, signal, "garment")); }
export async function recognizeLabel(image: HTMLImageElement, signal: AbortSignal) { return labelSchema.parse(await requestPhoto(image, signal, "label")); }
