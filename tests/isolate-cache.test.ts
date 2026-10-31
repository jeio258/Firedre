import { describe, expect, it } from "vitest";
import {
	readIsolateCache,
	writeIsolateCache,
} from "../server/utils/isolateCache";

describe("isolateCache 版本化+TTL 缓存", () => {
	it("版本命中且未过期 → 返回值", () => {
		writeIsolateCache("t.hit", "v1", { a: 1 });
		expect(readIsolateCache("t.hit", "v1", 1000)).toEqual({ a: 1 });
	});

	it("版本变化 → miss", () => {
		writeIsolateCache("t.ver", "v1", 123);
		expect(readIsolateCache("t.ver", "v2", 1000)).toBeUndefined();
	});

	it("过期 → miss", async () => {
		writeIsolateCache("t.ttl", "v1", "x");
		await new Promise((r) => setTimeout(r, 20));
		expect(readIsolateCache("t.ttl", "v1", 5)).toBeUndefined();
	});

	it("slot 相互隔离", () => {
		writeIsolateCache("t.a", "v1", "A");
		writeIsolateCache("t.b", "v1", "B");
		expect(readIsolateCache("t.a", "v1")).toBe("A");
		expect(readIsolateCache("t.b", "v1")).toBe("B");
	});
});
