// 邮件发送：provider 由 MAIL_PROVIDER 选择（smtp / brevo / none），见 ./index.ts。
// 本文件只负责 Brevo HTTP 发信与邮件模板；SMTP 见 ./smtp.ts。
import { escapeHtml } from "../../src/utils/escape-html";

export interface MailEnv {
	BREVO_API_KEY?: string;
	SMTP_HOST?: string;
	SMTP_PORT?: string;
	SMTP_USER?: string;
	SMTP_PASS?: string;
	SMTP_SECURE?: string; // "true"=465 隐式 TLS；缺省按端口判断
	MAIL_PROVIDER?: string; // smtp | brevo | none
	MAIL_DEBUG?: string; // "1"=注册响应回传验证链接（仅本地联调）
	MAIL_FROM?: string; // "no-reply@example.com" 或 "站点名 <no-reply@example.com>"
	ENVIRONMENT?: string; // 显式非 prod 才跳过真发；缺省按生产处理，防线上静默不发信
	DB?: D1Database;
}

export interface SendMailInput {
	to: string;
	subject: string;
	html: string;
}

export interface SendMailResult {
	ok: boolean;
	skipped?: boolean;
	/** 未真正发信的原因（skipped 时用于区分 dev / 未配置） */
	reason?: string;
	error?: string;
}

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_SENDER_NAME = "站点通知";

export function parseMailFrom(mailFrom: string | undefined): {
	name: string;
	email: string;
} {
	const raw = (mailFrom || "").trim();
	const m = raw.match(/^(.*?)<\s*([^<>]+?)\s*>$/);
	if (m) {
		const name = (m[1] || "").trim().replace(/^"|"$/g, "");
		return { name: name || DEFAULT_SENDER_NAME, email: m[2] };
	}
	return { name: DEFAULT_SENDER_NAME, email: raw };
}

async function postOnce(
	apiKey: string,
	body: string,
): Promise<{ ok: boolean; status: number; text: string }> {
	try {
		const r = await fetch(BREVO_ENDPOINT, {
			method: "POST",
			// Brevo 认证头必须是 api-key，写成 authorization 会被判为缺少认证
			headers: {
				"api-key": apiKey,
				"Content-Type": "application/json",
			},
			body,
			signal: AbortSignal.timeout(10_000),
		});
		const text = await r.text().catch(() => "");
		return { ok: r.ok, status: r.status, text };
	} catch (e) {
		return {
			ok: false,
			status: 0,
			text: (e as Error)?.message || "fetch failed",
		};
	}
}

/** 结果落库，尽力而为；mail_log 不存在（旧库未重放迁移）时静默跳过 */
export async function logMail(
	db: D1Database | undefined,
	to: string,
	subject: string,
	status: string,
	detail = "",
): Promise<void> {
	if (!db) return;
	const id = crypto.randomUUID();
	try {
		await db
			.prepare(
				"INSERT INTO mail_log (id, to_email, subject, status, detail) VALUES (?, ?, ?, ?, ?)",
			)
			.bind(id, to, subject.slice(0, 200), status, detail.slice(0, 500))
			.run();
		return;
	} catch {}
	// 旧库可能是上一轮尝试留下的 from/to/error 列；兼容写入，避免审计数据丢失
	try {
		await db
			.prepare(
				`INSERT INTO mail_log (id, "from", "to", subject, status, error) VALUES (?, '', ?, ?, ?, ?)`,
			)
			.bind(id, to, subject.slice(0, 200), status, detail.slice(0, 500))
			.run();
	} catch {}
}

export function stripHtmlForLog(html: string): string {
	const links = [...html.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0]);
	const text = html
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 400);
	return links.length ? `${text} | links: ${links.join(" ")}` : text;
}

/** Brevo HTTP 发信（失败重试 1 次，不记录日志；结果由 index.ts 统一落库） */
// Brevo 对未验证发件人的是"先收下再异步拒绝"（事件流里 event=error），
// 只看 HTTP 2xx 会误判成功，所以发送前先确认发件人已激活
const senderCache = globalThis as {
	__FIREDRE_BREVO_SENDERS__?: { at: number; list: string[] };
};
const SENDER_CACHE_MS = 5 * 60_000;

async function verifiedSenders(apiKey: string): Promise<string[] | null> {
	const cached = senderCache.__FIREDRE_BREVO_SENDERS__;
	if (cached && Date.now() - cached.at < SENDER_CACHE_MS) return cached.list;
	try {
		const r = await fetch("https://api.brevo.com/v3/senders?limit=100", {
			headers: { "api-key": apiKey, accept: "application/json" },
			signal: AbortSignal.timeout(8000),
		});
		if (!r.ok) return null;
		const data = (await r.json()) as {
			senders?: { email?: string; active?: boolean }[];
		};
		const list = (data.senders ?? [])
			.filter((x) => x.active && x.email)
			.map((x) => String(x.email).toLowerCase());
		senderCache.__FIREDRE_BREVO_SENDERS__ = { at: Date.now(), list };
		return list;
	} catch {
		return null;
	}
}

export async function sendViaBrevo(
	apiKey: string,
	sender: { name: string; email: string },
	input: SendMailInput,
): Promise<SendMailResult> {
	// 查询失败（网络/权限）时放行，交给真实发送结果判定，避免自己把自己卡死
	const senders = await verifiedSenders(apiKey);
	if (senders && !senders.includes(sender.email.toLowerCase())) {
		return {
			ok: false,
			error: `Brevo 发件人 ${sender.email} 未验证：请到 Brevo → Senders 添加并点击验证邮件，或改用已验证地址`,
		};
	}
	const payload = JSON.stringify({
		sender: { name: sender.name, email: sender.email },
		to: [{ email: input.to }],
		subject: input.subject,
		htmlContent: input.html,
	});

	let lastError = "";
	for (let attempt = 0; attempt < 2; attempt++) {
		const res = await postOnce(apiKey, payload);
		if (res.ok) return { ok: true };

		lastError = `HTTP ${res.status}: ${res.text.slice(0, 300)}`;
		console.error(`[mail:brevo] 发送失败（第 ${attempt + 1} 次）:`, lastError);
		if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
	}
	return { ok: false, error: lastError };
}

function renderShell(opts: {
	siteName: string;
	heading: string;
	intro: string;
	buttonText: string;
	url: string;
	expireText: string;
}): string {
	return `<!doctype html>
<html lang="zh-CN">
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:16px;padding:32px 28px;border:1px solid #e7e5e4;">
      <p style="font-size:13px;color:#78716c;margin:0 0 8px;">${escapeHtml(opts.siteName)}</p>
      <h1 style="font-size:20px;color:#1c1917;margin:0 0 12px;">${escapeHtml(opts.heading)}</h1>
      <p style="font-size:14px;color:#44403c;line-height:1.7;margin:0 0 24px;">${escapeHtml(opts.intro)}</p>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${escapeHtml(opts.url)}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 32px;border-radius:999px;">
          ${escapeHtml(opts.buttonText)}
        </a>
      </div>
      <p style="font-size:13px;color:#78716c;line-height:1.7;margin:0 0 6px;">${escapeHtml(opts.expireText)}</p>
      <p style="font-size:12px;color:#a8a29e;line-height:1.6;margin:16px 0 0;word-break:break-all;">
        如果按钮无法点击，请复制以下链接到浏览器打开：<br/>
        <a href="${escapeHtml(opts.url)}" style="color:#f97316;">${escapeHtml(opts.url)}</a>
      </p>
    </div>
    <p style="text-align:center;font-size:12px;color:#a8a29e;margin:16px 0 0;">
      这是一封系统邮件，请勿直接回复。
    </p>
  </div>
</body>
</html>`;
}

export function renderResetEmail(opts: {
	siteName: string;
	url: string;
	expireHours?: number;
}): { subject: string; html: string } {
	const hours = opts.expireHours ?? 1;
	return {
		subject: `重置密码 - ${opts.siteName}`,
		html: renderShell({
			siteName: opts.siteName,
			heading: "重置密码",
			intro:
				"我们收到了重置密码的请求。如果这不是你本人操作，请忽略本邮件，密码不会改变。",
			buttonText: "重置密码",
			url: opts.url,
			expireText: `重置链接 ${hours} 小时内有效，仅可使用一次。`,
		}),
	};
}
