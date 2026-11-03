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

/** 通道配置摘要：只报告「配没配」，不含任何凭据值，可安全进日志与后台响应 */
export interface MailConfigSummary {
	provider: MailProvider;
	devSkip: boolean;
	host: string | null;
	port: number | null;
	secure: boolean | null;
	userSet: boolean;
	passSet: boolean;
	from: string | null;
	/** 导致「配置齐了也发不出去」的缺失项，空数组=已就绪 */
	missing: string[];
}

export function describeMailConfig(env: MailEnv): MailConfigSummary {
	const provider = resolveMailProvider(env);
	const envTag = env.ENVIRONMENT?.trim().toLowerCase();
	const devSkip = Boolean(
		envTag && envTag !== "prod" && envTag !== "production",
	);
	const host = env.SMTP_HOST?.trim() || null;
	const rawPort = Number(env.SMTP_PORT || 465);
	const port = provider === "smtp" && Number.isFinite(rawPort) ? rawPort : null;
	const secure =
		port === null
			? null
			: env.SMTP_SECURE
				? env.SMTP_SECURE.trim() === "true"
				: port === 465;
	const userSet = Boolean(env.SMTP_USER?.trim());
	const passSet = Boolean(env.SMTP_PASS);
	const from = parseMailFrom(env.MAIL_FROM).email || null;

	const missing: string[] = [];
	if (devSkip) {
		missing.push(`ENVIRONMENT=${envTag}（非 prod 只打日志不发信）`);
	} else {
		if (provider === "none")
			missing.push("MAIL_PROVIDER 或 SMTP_HOST / BREVO_API_KEY");
		if (!from) missing.push("MAIL_FROM");
		if (provider === "smtp") {
			if (!host) missing.push("SMTP_HOST");
			if (!userSet) missing.push("SMTP_USER");
			if (!passSet) missing.push("SMTP_PASS");
		}
	}
	return {
		provider,
		devSkip,
		host,
		port,
		secure,
		userSet,
		passSet,
		from,
		missing,
	};
}

// 失败原文 → 可执行处置建议。SMTP 各家错误码语义不统一，只按已知前缀归类。
const MAIL_ERROR_HINTS: Array<[RegExp, string]> = [
	[
		/535|Login fail|authentication/i,
		"SMTP 认证被拒：QQ 邮箱须在网页端设置里开启 SMTP 服务，且 SMTP_PASS 必须填「授权码」而非登录密码；境外出口 IP 同样会被 535 拒绝，此时改用 BREVO_API_KEY 通道",
	],
	[
		/timeout|ETIMEDOUT|ECONNREFUSED|ECONNRESET|Connection/i,
		"SMTP 连接失败：核对 SMTP_HOST/SMTP_PORT（465 配 SMTP_SECURE=true，587 走 STARTTLS）与网络出口",
	],
	[
		/5[05][03]|Mail from|Sender|sender/i,
		"发件人被拒：MAIL_FROM 通常需与 SMTP_USER 同域，或已在服务商侧完成域名验证",
	],
];

export function explainMailError(raw: string): string {
	for (const [re, hint] of MAIL_ERROR_HINTS) if (re.test(raw)) return hint;
	return "";
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
		return { ok: true, skipped: true, reason: "dev" };
	}

	const provider = resolveMailProvider(env);
	if (provider === "none") {
		console.error(
			"[mail:not configured] 未配置任何发信通道，邮件不会送达:",
			input.to,
			"| 缺失:",
			describeMailConfig(env).missing.join("、"),
		);
		console.log("[mail:not configured:body]", stripHtmlForLog(input.html));
		await logMail(db, input.to, input.subject, "not_configured");
		return { ok: true, skipped: true, reason: "not_configured" };
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
		if (!result.ok) {
			const cfg = describeMailConfig(env);
			const hint = explainMailError(result.error ?? "");
			console.error(
				`[mail] SMTP 发送失败 to=${input.to} host=${cfg.host} port=${cfg.port} secure=${cfg.secure} user=${cfg.userSet ? "set" : "empty"} pass=${cfg.passSet ? "set" : "empty"} |`,
				result.error,
				hint ? `| 处置: ${hint}` : "",
			);
		}
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
	if (!result.ok)
		console.error(
			`[mail] Brevo 发送失败 to=${input.to} from=${sender.email} |`,
			result.error,
			"| 处置: 检查 BREVO_API_KEY 是否有效、发件人 MAIL_FROM 是否已在 Brevo 完成验证",
		);
	await logMail(
		db,
		input.to,
		input.subject,
		result.ok ? "sent" : "failed",
		result.ok ? `brevo=${sender.email}` : (result.error ?? ""),
	);
	return result;
}
