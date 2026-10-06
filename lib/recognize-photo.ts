import { z } from "zod";
import { recognitionSchema } from "./recognition-schema";

export async function recognizePhoto(image: HTMLImageElement, signal: AbortSignal) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法处理照片，请手动填写类别和颜色。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const response = await fetch("/api/recognize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: canvas.toDataURL("image/jpeg", 0.85) }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(55_000)]),
  });
  const body = await response.json();
  if (!response.ok) {
    const failure = z.object({ error: z.string() }).safeParse(body);
    throw new Error(failure.success ? failure.data.error : "识别失败，请重试或手动填写。");
  }
  return recognitionSchema.parse(body);
}
