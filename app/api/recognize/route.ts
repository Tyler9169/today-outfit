import { env } from "cloudflare:workers";
import { recognize, VisionError } from "@/lib/vision";
const headers = { "Cache-Control": "no-store" };
function configuration() {
  const values = { VISION_API_KEY: env.VISION_API_KEY, VISION_API_URL: env.VISION_API_URL, VISION_MODEL: env.VISION_MODEL };
  return { values, missing: Object.entries(values).filter(([,v]) => !v?.trim()).map(([k]) => k) };
}
export async function GET() {
  const { missing } = configuration();
  return Response.json({ configured: missing.length === 0, missing }, { headers });
}
export async function POST(request: Request) {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ error: "不允许跨站识别请求。" }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return reply({ error: "请求格式不正确。" }, 415);
  const { values, missing } = configuration();
  if (missing.length) return reply({ error: `识别服务未配置：${missing.join("、")}。可手动录入。` }, 503);
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "缺少照片。" }, 400);
  let text = "", size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 3_000_000) { await reader.cancel(); return reply({ error: "图片过大，请选择较小照片。" }, 413); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch { return reply({ error: "上传中断，请重试。" }, 400); }
  let image: unknown, mode: "garment" | "label" = "garment";
  try { const body = JSON.parse(text); image = body?.image; if(body?.mode !== undefined && body.mode !== "garment" && body.mode !== "label") return reply({ error: "识别模式不正确。" }, 400); mode = body?.mode ?? "garment"; } catch { return reply({ error: "请求格式不正确。" }, 400); }
  if (typeof image !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) return reply({ error: "请上传有效照片。" }, 400);
  try {
    return reply(await recognize(image, { key: values.VISION_API_KEY, url: values.VISION_API_URL, model: values.VISION_MODEL }, request.signal, mode));
  } catch (error) {
    if (error instanceof VisionError) return reply({ error: error.message }, error.status);
    return reply({ error: "识别超时或网络失败，请重试或手动录入。" }, 502);
  }
}
