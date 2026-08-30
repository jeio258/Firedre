import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchImgbedPhotos } from "../server/gallery/imgbed";
import { UserError } from "../server/utils/userError";

/**
 * 图床 API 拉取服务测试（方案①）：
 * mock global.fetch 模拟 cfbed /api/manage/list 响应，验证直链拼接与类型识别。
 */

const LIST_URL =
	"https://cfbed.sanyue.de/api/manage/list?dir=firefly-2026&count=-1";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("fetchImgbedPhotos", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("拉取文件列表并拼成公开直链", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			jsonResponse({
				files: [
					{ name: "a.jpg", metadata: { "File-Mime": "image/jpeg" } },
					{ name: "sub/b.png" },
					{ name: "notes.txt" },
				],
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const photos = await fetchImgbedPhotos(
			"https://cfbed.sanyue.de",
			"test-token",
			"firefly-2026",
		);

		// 校验鉴权 header 与 URL
		expect(fetchMock).toHaveBeenCalledWith(
			LIST_URL,
			expect.objectContaining({
				headers: { Authorization: "Bearer test-token" },
			}),
		);

		// 图片：a.jpg → 直链 + 类型；sub/b.png → 直链；notes.txt 被过滤
		expect(photos).toHaveLength(2);
		expect(photos[0]).toEqual({
			url: "https://cfbed.sanyue.de/file/a.jpg",
			type: "image",
		});
		expect(photos[1]).toEqual({
			url: "https://cfbed.sanyue.de/file/sub/b.png",
		});
	});

	it("HTTP 非 2xx 抛 UserError", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(jsonResponse({}, false, 403)),
		);
		await expect(
			fetchImgbedPhotos("https://cfbed.sanyue.de", "bad", "x"),
		).rejects.toThrow(UserError);
	});

	it("目录无文件抛 UserError", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(jsonResponse({ files: [] })),
		);
		await expect(
			fetchImgbedPhotos("https://cfbed.sanyue.de", "t", "empty"),
		).rejects.toThrow(/未找到文件/);
	});

	it("目录留空不携带 dir 参数（根目录）", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			jsonResponse({ files: [{ name: "a.jpg" }] }),
		);
		vi.stubGlobal("fetch", fetchMock);

		const photos = await fetchImgbedPhotos(
			"https://cfbed.sanyue.de",
			"test-token",
			"",
		);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://cfbed.sanyue.de/api/manage/list?count=-1",
			expect.objectContaining({
				headers: { Authorization: "Bearer test-token" },
			}),
		);
		expect(photos).toEqual([
			{ url: "https://cfbed.sanyue.de/file/a.jpg" },
		]);
	});

	it("端点为非法协议抛 UserError", async () => {
		await expect(fetchImgbedPhotos("ftp://bad", "t", "x")).rejects.toThrow(
			/http\(s\)/,
		);
	});
});
