// D1 serializes this INSERT with its quota checks across Worker isolates.
// Store only accounting metadata; never persist photos, prompts or model keys.
export async function reserveRecognition(db: D1Database, owner: string, now = Date.now()) {
  const dayStart = Math.floor(now / 86_400_000) * 86_400_000;
  const id = crypto.randomUUID();
  const result = await db.prepare(`INSERT INTO recognition_requests (id, owner, started, finished)
    SELECT ?, ?, ?, 0
    WHERE (SELECT COUNT(*) FROM recognition_requests WHERE started >= ?) < 50
      AND (SELECT COUNT(*) FROM recognition_requests WHERE owner = ? AND started >= ?) < 20
      AND (SELECT COUNT(*) FROM recognition_requests WHERE owner = ? AND started > ?) < 6
      AND (SELECT COUNT(*) FROM recognition_requests WHERE finished = 0 AND started > ?) < 2
    RETURNING id`).bind(id, owner, now, dayStart, owner, dayStart, owner, now - 60_000, now - 90_000).first<{id:string}>();
  return result?.id ?? null;
}
export async function finishRecognition(db: D1Database, id: string) {
  // Failed calls still consume the daily allowance, preventing retry loops from overspending.
  await db.prepare('UPDATE recognition_requests SET finished = 1 WHERE id = ?').bind(id).run();
  await db.prepare('DELETE FROM recognition_requests WHERE started < ?').bind(Date.now() - 172_800_000).run();
}
