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

	const username = env.SMTP_USER?.trim();
	const password = env.SMTP_PASS || "";
	const sender = parseMailFrom(env.MAIL_FROM || username);
	if (!sender.email) return { ok: false, error: "MAIL_FROM missing" };

	// cloudflare:sockets 偶发把 smtp.qq.com 判成 TCP Loop（同一端口重试无效），
	// 故按端口轮换重试：587(STARTTLS) ↔ 465(隐式 TLS)，换一条出站路径
	const ports = [port, port === 587 ? 465 : 587];
	let lastError = "";
	for (let attempt = 0; attempt < 4; attempt++) {
		const attemptPort = ports[attempt % ports.length];
		const attemptSecure = attemptPort === 465;
		try {
			const { WorkerMailer } = await import("worker-mailer");
			await WorkerMailer.send(
				{
					host,
					port: attemptPort,
					secure: attemptSecure,
					startTls: !attemptSecure,
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
			lastError = `${(e as Error)?.message || "smtp send failed"} (port ${attemptPort})`;
			console.error(
				`[mail:smtp] 发送失败（第 ${attempt + 1} 次 / 端口 ${attemptPort}）:`,
				lastError,
			);
			if (attempt < 3)
				await new Promise((r) => setTimeout(r, 300 + attempt * 400));
		}
	}
	return { ok: false, error: lastError };
}
