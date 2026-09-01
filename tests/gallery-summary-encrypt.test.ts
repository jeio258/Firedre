import { describe, it, expect, beforeEach } from "vitest";
import { getGalleryHub } from "../server/gallery/service";
import { GALLERY_HUB_R2_KEY, galleryAlbumR2Key } from "../server/gallery/constants";

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

function makeR2Mock(objects: Record<string, string>) {
	return {
		async get(key: string): Promise<{ text(): Promise<string> } | null> {
			const v = objects[key];
			return v === undefined ? null : { text: async () => v };
		},
	};
}

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
		expect(summary?.cover).toBeUndefined();                    
		expect(summary?.count).toBeUndefined();         
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
