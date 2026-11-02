import type { MailEnv, SendMailInput, SendMailResult } from "./brevo";
import { parseMailFrom } from "./brevo";

// SMTP 发信：worker-mailer 基于 cloudflare:sockets，Node 环境不可用，
// 故动态导入；dev/未配置时由 index.ts 提前返回，不会走到这里。
export async function sendViaSmtp(
	env: MailEnv,
	input: SendMailInput,
): Promise<SendMailResult> {
	const host = env.SMTP_HOST?.trim();
	if (!host) return { ok: false, error: "SMTP_HOST missing" };

	const port = Number(env.SMTP_PORT || 465);
	if (!Number.isFinite(port) || port <= 0)
		return { ok: false, error: "SMTP_PORT invalid" };

	const secure = env.SMTP_SECURE
		? env.SMTP_SECURE.trim() === "true"
		: port === 465;

	const username = env.SMTP_USER?.trim();
	const password = env.SMTP_PASS || "";
	const sender = parseMailFrom(env.MAIL_FROM || username);
	if (!sender.email) return { ok: false, error: "MAIL_FROM missing" };

	let lastError = "";
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const { WorkerMailer } = await import("worker-mailer");
			await WorkerMailer.send(
				{
					host,
					port,
					secure,
					startTls: !secure,
					...(username
						? {
								credentials: { username, password },
								authType: "plain" as const,
							}
						: {}),
					name: "firedre",
					socketTimeoutMs: 15_000,
					responseTimeoutMs: 15_000,
				},
				{
					from: { name: sender.name, email: sender.email },
					to: input.to,
					subject: input.subject,
					html: input.html,
				},
			);
			return { ok: true };
		} catch (e) {
			lastError = (e as Error)?.message || "smtp send failed";
			console.error(`[mail:smtp] 发送失败（第 ${attempt + 1} 次）:`, lastError);
			if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
		}
	}
	return { ok: false, error: lastError };
}
