import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import {
	listComments,
	listCommentsForAdmin,
	moderateComment,
	submitComment,
} from "../server/comments/service";
import { UserError } from "../server/utils/userError";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

const TARGET = "/posts/hello";

let db: DatabaseSync;
let d1: D1Database;

function seedUser(id: string, name: string, avatar = ""): void {
	db.prepare(
		"INSERT INTO users (id, email, name, avatar) VALUES (?, ?, ?, ?)",
	).run(id, `${id}@example.com`, name, avatar);
}

function member(id: string, name: string, avatar = "") {
	return { id, name, avatar };
}

beforeEach(() => {
	db = new DatabaseSync(":memory:");
	applyMigrations(db);
	// comments.user_id 有外键，登录态的用例必须先有 users 行
	seedUser("u1", "阿泽", "/avatar/u1.png");
	seedUser("u2", "小满");
	d1 = makeD1(db) as unknown as D1Database;
});

describe("提交评论：匿名待审 / 登录直发", () => {
	it("匿名提交落 pending，且匿名访客看不到", async () => {
		const out = await submitComment(
			d1,
			{
				target: TARGET,
				content: "路过的第一条",
				guestName: "路人",
				ip: "1.2.3.4",
			},
			null,
		);
		expect(out.status).toBe("pending");
		expect(out.comment.isMember).toBe(false);
		expect(out.comment.authorName).toBe("路人");

		const list = await listComments(d1, { target: TARGET });
		expect(list.total).toBe(0);
		expect(list.items).toHaveLength(0);
	});

	it("登录提交直接 approved，并写入 user_id", async () => {
		const out = await submitComment(
			d1,
			{ target: TARGET, content: "登录直发" },
			member("u1", "阿泽", "/avatar/u1.png"),
		);
		expect(out.status).toBe("approved");
		expect(out.comment.isMember).toBe(true);
		expect(out.comment.avatar).toBe("/avatar/u1.png");

		const row = db
			.prepare("SELECT user_id, status FROM comments WHERE id = ?")
			.get(out.comment.id) as { user_id: string; status: string };
		expect(row.user_id).toBe("u1");
		expect(row.status).toBe("approved");

		const list = await listComments(d1, { target: TARGET });
		expect(list.total).toBe(1);
		expect(list.items[0].authorName).toBe("阿泽");
	});

	it("匿名缺昵称、空内容、超长内容都拒绝", async () => {
		await expect(
			submitComment(d1, { target: TARGET, content: "hi" }, null),
		).rejects.toBeInstanceOf(UserError);
		await expect(
			submitComment(
				d1,
				{ target: TARGET, content: "  ", guestName: "路人" },
				null,
			),
		).rejects.toBeInstanceOf(UserError);
		await expect(
			submitComment(
				d1,
				{ target: TARGET, content: "x".repeat(2001), guestName: "路人" },
				null,
			),
		).rejects.toBeInstanceOf(UserError);
	});
});

describe("列表可见性：只有 approved 对匿名可见", () => {
	it("匿名列表只含 approved，登录者只额外看到自己的 pending", async () => {
		const pending = await submitComment(
			d1,
			{ target: TARGET, content: "待审", guestName: "路人" },
			null,
		);
		const approved = await submitComment(
			d1,
			{ target: TARGET, content: "已通过" },
			member("u1", "阿泽"),
		);
		// 作者本人的评论被后台改回 pending 时，只有本人能再看到
		await db
			.prepare("UPDATE comments SET status = 'pending' WHERE id = ?")
			.run(approved.comment.id);
		const other = await submitComment(
			d1,
			{ target: TARGET, content: "他人已通过" },
			member("u2", "小满"),
		);

		const anonymous = await listComments(d1, { target: TARGET });
		expect(anonymous.items.map((c) => c.id)).toEqual([other.comment.id]);

		const asU1 = await listComments(d1, {
			target: TARGET,
			viewerId: "u1",
		});
		expect(new Set(asU1.items.map((c) => c.id))).toEqual(
			new Set([approved.comment.id, other.comment.id]),
		);

		const asU2 = await listComments(d1, {
			target: TARGET,
			viewerId: "u2",
		});
		expect(new Set(asU2.items.map((c) => c.id))).toEqual(
			new Set([other.comment.id]),
		);
		// 匿名待审评论对任何人（含登录者）都不可见
		expect(asU1.items.some((c) => c.id === pending.comment.id)).toBe(false);
	});

	it("target 精确隔离，不串到其它文章", async () => {
		await submitComment(
			d1,
			{ target: "/posts/other", content: "别的文章" },
			member("u1", "阿泽"),
		);
		const list = await listComments(d1, { target: TARGET });
		expect(list.total).toBe(0);
	});
});

describe("回复：父评论必须 approved 且同为一级", () => {
	it("回复 approved 父评论成功并归位", async () => {
		const parent = await submitComment(
			d1,
			{ target: TARGET, content: "父评论" },
			member("u1", "阿泽"),
		);
		const reply = await submitComment(
			d1,
			{ target: TARGET, content: "回复内容", parentId: parent.comment.id },
			member("u2", "小满"),
		);
		expect(reply.comment.parentId).toBe(parent.comment.id);

		const list = await listComments(d1, { target: TARGET });
		expect(list.items).toHaveLength(1);
		expect(list.items[0].replies.map((c) => c.id)).toEqual([reply.comment.id]);
	});

	it("回复待审/已删父评论被拒绝", async () => {
		const pending = await submitComment(
			d1,
			{ target: TARGET, content: "待审父", guestName: "路人" },
			null,
		);
		await expect(
			submitComment(
				d1,
				{
					target: TARGET,
					content: "抢回复",
					guestName: "路人",
					parentId: pending.comment.id,
				},
				null,
			),
		).rejects.toThrow("回复的评论不存在");

		const approved = await submitComment(
			d1,
			{ target: TARGET, content: "父" },
			member("u1", "阿泽"),
		);
		await moderateComment(d1, approved.comment.id, "delete");
		await expect(
			submitComment(
				d1,
				{ target: TARGET, content: "回复已删", parentId: approved.comment.id },
				member("u1", "阿泽"),
			),
		).rejects.toThrow("回复的评论不存在");
	});

	it("跨 target 与二级回复被拒绝", async () => {
		const parent = await submitComment(
			d1,
			{ target: "/posts/other", content: "父" },
			member("u1", "阿泽"),
		);
		await expect(
			submitComment(
				d1,
				{ target: TARGET, content: "跨文章", parentId: parent.comment.id },
				member("u1", "阿泽"),
			),
		).rejects.toThrow("回复目标不匹配");

		const reply = await submitComment(
			d1,
			{
				target: "/posts/other",
				content: "一级回复",
				parentId: parent.comment.id,
			},
			member("u2", "小满"),
		);
		await expect(
			submitComment(
				d1,
				{
					target: "/posts/other",
					content: "二级回复",
					parentId: reply.comment.id,
				},
				member("u1", "阿泽"),
			),
		).rejects.toThrow("仅支持一级回复");
	});
});

describe("审核与软删", () => {
	it("approve 后匿名可见，delete 软删后不可见但保留行", async () => {
		const pending = await submitComment(
			d1,
			{ target: TARGET, content: "待审内容", guestName: "路人" },
			null,
		);

		expect(await moderateComment(d1, pending.comment.id, "approve")).toEqual({
			ok: true,
		});
		expect((await listComments(d1, { target: TARGET })).total).toBe(1);

		expect(await moderateComment(d1, pending.comment.id, "delete")).toEqual({
			ok: true,
		});
		expect((await listComments(d1, { target: TARGET })).total).toBe(0);

		const row = db
			.prepare("SELECT status FROM comments WHERE id = ?")
			.get(pending.comment.id) as { status: string };
		expect(row.status).toBe("deleted");

		const deletedList = await listCommentsForAdmin(d1, { status: "deleted" });
		expect(deletedList.items.map((c) => c.id)).toEqual([pending.comment.id]);
	});

	it("spam 不进前台列表，后台按状态可查", async () => {
		const out = await submitComment(
			d1,
			{ target: TARGET, content: "广告" },
			member("u1", "阿泽"),
		);
		await moderateComment(d1, out.comment.id, "spam");
		expect((await listComments(d1, { target: TARGET })).total).toBe(0);

		const spam = await listCommentsForAdmin(d1, { status: "spam" });
		expect(spam.total).toBe(1);
		expect(spam.items[0].authorName).toBe("阿泽");
	});

	it("软删父评论后其回复在前台一并消失", async () => {
		const parent = await submitComment(
			d1,
			{ target: TARGET, content: "父" },
			member("u1", "阿泽"),
		);
		await submitComment(
			d1,
			{ target: TARGET, content: "子", parentId: parent.comment.id },
			member("u1", "阿泽"),
		);
		await moderateComment(d1, parent.comment.id, "delete");
		const list = await listComments(d1, { target: TARGET });
		expect(list.items).toHaveLength(0);
	});

	it("审核不存在的评论返回 ok:false", async () => {
		expect(await moderateComment(d1, "no-such-id", "approve")).toEqual({
			ok: false,
		});
	});
});
