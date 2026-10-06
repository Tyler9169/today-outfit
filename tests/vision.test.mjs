import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./load-ts.mjs";
const { recognize } = await loadTs("../lib/vision.ts");
const config = { key: "test-key", url: "https://example.com/v1/chat/completions", model: "test-vision" };
const photo = "data:image/jpeg;base64,/9j/";

test("missing configuration does not send photos", async () => {
  await assert.rejects(recognize(photo, {}), { status: 503 });
});
test("insecure endpoint is rejected", async () => {
  await assert.rejects(recognize(photo, { ...config, url: "http://example.com" }), { status: 503 });
});
test("valid result, unknown garments, invalid output, and API errors", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), config.url);
      assert.equal(options.headers.Authorization, "Bearer test-key");
      const body = JSON.parse(options.body);
      assert.equal(body.model, config.model);
      assert.equal(body.messages[1].content[1].image_url.url, photo);
      return Response.json({ choices: [{ message: { content: '{"category":"上衣","color":"米白色"}' } }] });
    };
    assert.deepEqual(await recognize(photo, config), { category: "上衣", color: "米白色", needsConfirmation: false });
    globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '{"category":null,"color":null}' } }] });
    assert.deepEqual(await recognize(photo, config), { category: null, color: null, needsConfirmation: false });
    globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '{"category":null,"color":"多色","needsConfirmation":true}' } }] });
    assert.deepEqual(await recognize(photo, config), { category: null, color: "多色", needsConfirmation: true });
    for (const content of ['{"category":"裙子","color":"红色"}', 'not json', '{"category":"上衣","color":""}']) {
      globalThis.fetch = async () => Response.json({ choices: [{ message: { content } }] });
      await assert.rejects(recognize(photo, config), { status: 502 });
    }
    for (const status of [401, 403, 429, 500]) {
      globalThis.fetch = async () => new Response("private upstream detail", { status });
      await assert.rejects(recognize(photo, config), (error) => error.status === (status === 429 ? 429 : 502) && !error.message.includes("private"));
    }
    globalThis.fetch = async (_url, options) => { options.signal.throwIfAborted(); };
    await assert.rejects(recognize(photo, config, AbortSignal.abort()), { name: "AbortError" });
  } finally { globalThis.fetch = original; }
});
