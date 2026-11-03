import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
	describeMailConfig,
	explainMailError,
	resolveMailProvider,
	sendMail,
} from "../server/mail";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

function d1() {
	return new DatabaseSync(":memory:");
}

describe("describeMailConfig 配置摘要", () => {
	it("生产 SMTP 配齐时无缺失项，且不回显账号与口令", () => {
		const cfg = describeMailConfig({
			ENVIRONMENT: "prod",
			SMTP_HOST: "smtp.example.com",
			SMTP_PORT: "465",
			SMTP_USER: "auth-user@example.com",
			SMTP_PASS: "secret-auth-code",
			MAIL_FROM: "站点 <no-reply@example.com>",
		});
		expect(cfg.missing).toEqual([]);
		expect(cfg).toMatchObject({
			provider: "smtp",
			devSkip: false,
			port: 465,
			secure: true,
			userSet: true,
			passSet: true,
		});
		const dumped = JSON.stringify(cfg);
		expect(dumped).not.toContain("secret-auth-code");
		expect(dumped).not.toContain("auth-user@example.com");
	});

	it("缺 SMTP_PASS 时明确列为缺失项", () => {
		const cfg = describeMailConfig({
			ENVIRONMENT: "prod",
			SMTP_HOST: "smtp.example.com",
			SMTP_USER: "u@example.com",
			MAIL_FROM: "u@example.com",
		});
		expect(cfg.missing).toContain("SMTP_PASS");
		expect(cfg.passSet).toBe(false);
	});

	it("ENVIRONMENT 非 prod 时按只打日志处理", () => {
		const cfg = describeMailConfig({
			ENVIRONMENT: "dev",
			SMTP_HOST: "smtp.example.com",
			SMTP_USER: "u@example.com",
			SMTP_PASS: "x",
			MAIL_FROM: "u@example.com",
		});
		expect(cfg.devSkip).toBe(true);
		expect(cfg.missing.join()).toContain("ENVIRONMENT=dev");
	});

	it("没有任何通道时 provider=none 且列出缺失项", () => {
		const cfg = describeMailConfig({ ENVIRONMENT: "prod" });
		expect(cfg.provider).toBe("none");
		expect(cfg.missing.length).toBeGreaterThan(0);
	});

	it("587 端口默认走 STARTTLS", () => {
		const cfg = describeMailConfig({
			SMTP_HOST: "smtp.example.com",
			SMTP_PORT: "587",
		});
		expect(cfg.secure).toBe(false);
		expect(resolveMailProvider({ SMTP_HOST: "smtp.example.com" })).toBe("smtp");
	});
});

describe("explainMailError 处置建议", () => {
	it("535 认证失败给出授权码提示", () => {
		const hint = explainMailError(
			"Failed to plain authentication: 535 Login fail. Account is abnormal",
		);
		expect(hint).toContain("授权码");
		expect(hint).toContain("BREVO_API_KEY");
	});

	it("连接超时给出端口/TLS 提示", () => {
		expect(explainMailError("Connection timeout")).toContain("SMTP_PORT");
	});

	it("未知错误不编造建议", () => {
		expect(explainMailError("weird failure")).toBe("");
	});
});

describe("sendMail 未就绪路径不静默", () => {
	it("无 provider 时 skipped 带 reason 并落库 not_configured", async () => {
		const sqlite = d1();
		applyMigrations(sqlite);
		const result = await sendMail(
			{ DB: makeD1(sqlite), ENVIRONMENT: "prod" } as never,
			{ to: "u@test.com", subject: "验证", html: "<p>hi</p>" },
		);
		expect(result).toMatchObject({ ok: true, skipped: true });
		expect(result.reason).toBe("not_configured");
		const row = sqlite
			.prepare("SELECT status FROM mail_log WHERE to_email='u@test.com'")
			.get() as { status: string } | undefined;
		expect(row?.status).toBe("not_configured");
		sqlite.close();
	});

	it("缺 MAIL_FROM 时返回失败而非成功", async () => {
		const sqlite = d1();
		applyMigrations(sqlite);
		const result = await sendMail(
			{
				DB: makeD1(sqlite),
				ENVIRONMENT: "prod",
				SMTP_HOST: "smtp.example.com",
				SMTP_USER: "u@example.com",
				SMTP_PASS: "x",
			} as never,
			{ to: "u@test.com", subject: "验证", html: "<p>hi</p>" },
		);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("MAIL_FROM");
		const row = sqlite
			.prepare("SELECT status FROM mail_log WHERE to_email='u@test.com'")
			.get() as { status: string } | undefined;
		expect(row?.status).toBe("no_sender");
		sqlite.close();
	});
});
