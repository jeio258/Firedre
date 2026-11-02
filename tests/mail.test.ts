import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { parseMailFrom, resolveMailProvider, sendMail } from "../server/mail";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

function d1() {
	return new DatabaseSync(":memory:");
}

describe("邮件 provider 选择", () => {
	it("显式 MAIL_PROVIDER 优先", () => {
		expect(
			resolveMailProvider({
				MAIL_PROVIDER: "brevo",
				SMTP_HOST: "smtp.test",
			}),
		).toBe("brevo");
		expect(resolveMailProvider({ MAIL_PROVIDER: "none", SMTP_HOST: "x" })).toBe(
			"none",
		);
	});

	it("未显式时 SMTP 优先于 Brevo", () => {
		expect(resolveMailProvider({ SMTP_HOST: "smtp.test" })).toBe("smtp");
		expect(resolveMailProvider({ BREVO_API_KEY: "key" })).toBe("brevo");
		expect(resolveMailProvider({})).toBe("none");
	});

	it("MAIL_FROM 支持 name <email>", () => {
		expect(parseMailFrom("站点 <no-reply@test.com>")).toEqual({
			name: "站点",
			email: "no-reply@test.com",
		});
	});
});

describe("sendMail 非生产与未配置", () => {
	it("ENVIRONMENT=dev 只写 mail_log 并返回 skipped", async () => {
		const sqlite = d1();
		applyMigrations(sqlite);
		const env = {
			DB: makeD1(sqlite),
			ENVIRONMENT: "dev",
			SMTP_HOST: "smtp.test",
		} as never;
		const result = await sendMail(env, {
			to: "u@test.com",
			subject: "验证",
			html: "<p>hi</p>",
		});
		expect(result).toMatchObject({ ok: true, skipped: true });
		const row = sqlite
			.prepare("SELECT status FROM mail_log WHERE to_email='u@test.com'")
			.get() as { status: string } | undefined;
		expect(row?.status).toBe("skipped_dev");
		sqlite.close();
	});

	it("无任何 provider 时打日志并 skipped", async () => {
		const sqlite = d1();
		applyMigrations(sqlite);
		const env = { DB: makeD1(sqlite), ENVIRONMENT: "prod" } as never;
		const result = await sendMail(env, {
			to: "u@test.com",
			subject: "验证",
			html: "<p>hi</p>",
		});
		expect(result).toMatchObject({ ok: true, skipped: true });
		const row = sqlite
			.prepare("SELECT status FROM mail_log WHERE to_email='u@test.com'")
			.get() as { status: string } | undefined;
		expect(row?.status).toBe("not_configured");
		sqlite.close();
	});
});
