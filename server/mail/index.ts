import {
	logMail,
	type MailEnv,
	parseMailFrom,
	type SendMailInput,
	type SendMailResult,
	sendViaBrevo,
	stripHtmlForLog,
} from "./brevo";
import { sendViaSmtp } from "./smtp";

export * from "./brevo";
export { sendViaSmtp } from "./smtp";

export type MailProvider = "smtp" | "brevo" | "none";

/** 显式 MAIL_PROVIDER 优先；否则按已配置的凭据推断（SMTP 优先于 Brevo） */
export function resolveMailProvider(env: MailEnv): MailProvider {
	const explicit = env.MAIL_PROVIDER?.trim().toLowerCase();
	if (explicit === "smtp" || explicit === "brevo" || explicit === "none")
		return explicit;
	if (env.SMTP_HOST?.trim()) return "smtp";
	if (env.BREVO_API_KEY?.trim()) return "brevo";
	return "none";
}

/**
 * 发送邮件。失败重试 1 次，绝不抛出。
 * - ENVIRONMENT 非 prod：只打日志（含验证链接），便于本地取链接；
 * - 未配置任何 provider：同样只打日志并返回 ok；
 * - 生产：按 MAIL_PROVIDER（默认按凭据推断）走 SMTP 或 Brevo。
 */
export async function sendMail(
	env: MailEnv,
	input: SendMailInput,
): Promise<SendMailResult> {
	const db = env.DB;
	const envTag = env.ENVIRONMENT?.trim();

	if (envTag && envTag !== "prod" && envTag !== "production") {
		console.log(
			"[mail:dev skip]",
			input.to,
			"|",
			input.subject,
			"|",
			stripHtmlForLog(input.html),
		);
		await logMail(
			db,
			input.to,
			input.subject,
			"skipped_dev",
			`ENVIRONMENT=${envTag}`,
		);
		return { ok: true, skipped: true };
	}

	const provider = resolveMailProvider(env);
	if (provider === "none") {
		console.log(
			"[mail:not configured]",
			input.to,
			"|",
			input.subject,
			"|",
			stripHtmlForLog(input.html),
		);
		await logMail(db, input.to, input.subject, "not_configured");
		return { ok: true, skipped: true };
	}

	const sender = parseMailFrom(env.MAIL_FROM);
	if (!sender.email) {
		console.error("[mail] MAIL_FROM 未配置，邮件未发送:", input.to);
		await logMail(db, input.to, input.subject, "no_sender");
		return { ok: false, error: "MAIL_FROM missing" };
	}

	if (provider === "smtp") {
		if (!env.SMTP_HOST?.trim()) {
			console.error("[mail] SMTP_HOST 未配置，邮件未发送:", input.to);
			await logMail(db, input.to, input.subject, "no_smtp_host");
			return { ok: false, error: "SMTP_HOST missing" };
		}
		const result = await sendViaSmtp(env, input);
		await logMail(
			db,
			input.to,
			input.subject,
			result.ok ? "sent" : "failed",
			result.ok ? `smtp=${env.SMTP_HOST}` : (result.error ?? ""),
		);
		return result;
	}

	const apiKey = env.BREVO_API_KEY?.trim();
	if (!apiKey) {
		console.error("[mail] BREVO_API_KEY 未配置，邮件未发送:", input.to);
		await logMail(db, input.to, input.subject, "no_api_key");
		return { ok: false, error: "BREVO_API_KEY missing" };
	}
	const result = await sendViaBrevo(apiKey, sender, input);
	await logMail(
		db,
		input.to,
		input.subject,
		result.ok ? "sent" : "failed",
		result.ok ? `brevo=${sender.email}` : (result.error ?? ""),
	);
	return result;
}
