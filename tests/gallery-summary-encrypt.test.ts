import { describe, it, expect, beforeEach } from "vitest";
import { getGalleryHub } from "../server/gallery/service";
import { GALLERY_HUB_R2_KEY, galleryAlbumR2Key } from "../server/gallery/constants";

/**
 * 相册加密判定单一来源回归测试。
 *
 * 背景：密码存 D1（album_passwords），R2 frontmatter 里的 encrypted 只是冗余标记，
 * 二者可能不同步（如 firefly-2026：R2 encrypted=false 但 D1 有密码）。相册列表却按
 * R2 判定加密 → 加密相册仍显示封面 → 封面文件被 gallery-files 上锁 → 401 破图。
 * 重构后：loadAlbumSummary 一切以 D1 密码为准，R2 说未加密但仍算出加密 → 隐藏封面与数量。
 */

function makeD1Mock() {
	const store = new Map<string, string>();
	const db: Record<string, unknown> = {
		prepare(sql: string) {
			const fn = {
				bind: (...args: unknown[]) => {
					const bound = { sql, args };
					return {
						first: async () => {
							if (sql.includes("SELECT password FROM album_passwords")) {
								const pwd = store.get(String(bound.args[0]));
								return pwd ? { password: pwd } : null;
							}
							return null;
						},
						run: async () => ({ success: true }),
					};
				},
			};
			return fn;
		},
	};
	return { db, store };
}

/** in-memory R2：key -> markdown 内容 */
function makeR2Mock(objects: Record<string, string>) {
	return {
		async get(key: string): Promise<{ text(): Promise<string> } | null> {
			const v = objects[key];
			return v === undefined ? null : { text: async () => v };
		},
	};
}

// R2 相册 index.md：encrypted 显式为 false（模拟 D1/R2 不同步的历史数据）
const albumMd =
	"---\nlayout: gallery-album\ntitle: 流萤\nsource: local\nencrypted: false\ncover: /api/gallery-files/firefly/files/cover.avif/\nphotos:\n  - url: /api/gallery-files/firefly/files/1.jpg\n  - url: /api/gallery-files/firefly/files/2.jpg\n---\n\n";
const hubMd = "---\nlayout: gallery\nalbums:\n  - firefly\n---\n";

describe("getGalleryHub：加密判定以 D1 密码为准（消除 R2 封面破图）", () => {
	let d1: ReturnType<typeof makeD1Mock>;
	let r2: ReturnType<typeof makeR2Mock>;
	let env: { DB: unknown; BUCKET: unknown };

	beforeEach(() => {
		d1 = makeD1Mock();
		r2 = makeR2Mock({
			[GALLERY_HUB_R2_KEY]: hubMd,
			[galleryAlbumR2Key("firefly")]: albumMd,
		});
		env = { DB: d1.db, BUCKET: r2 };
	});

	it("D1 有密码但 R2 标 false → 仍判定加密并隐藏封面/数量", async () => {
		d1.store.set("firefly", "secret");
		const hub = await getGalleryHub(env as never);
		const summary = hub?.albums?.[0];
		expect(summary?.encrypted).toBe(true);
		expect(summary?.cover).toBeUndefined(); // 封面被上锁，不再返回破图 URL
		expect(summary?.count).toBeUndefined(); // 数量不泄露
		expect(summary?.slug).toBe("firefly");
	});

	it("D1 无密码 → 按未加密处理，封面/数量保留", async () => {
		const hub = await getGalleryHub(env as never);
		const summary = hub?.albums?.[0];
		expect(summary?.encrypted).toBeFalsy();
		expect(summary?.cover).toBe(
			"/api/gallery-files/firefly/files/cover.avif/",
		);
		expect(summary?.count).toBe(2);
	});
});
