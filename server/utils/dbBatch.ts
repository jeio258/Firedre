export async function runDbBatch(
	db: D1Database,
	stmts: D1PreparedStatement[],
): Promise<void> {
	if (!stmts.length) return;
	if (typeof db.batch === "function") {
		await db.batch(stmts);
		return;
	}
	for (const stmt of stmts) await stmt.run();
}
