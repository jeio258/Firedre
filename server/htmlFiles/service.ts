import type { CloudflareEnv } from "../../types/env";
import type {
	HtmlFileDetail,
	HtmlFileSummary,
	HtmlFileUpsertPayload,
} from "../../types/htmlFile";
import {
	HTML_FILE_SLUG_RE,
	htmlFilePublicPath,
	htmlFileR2Key,
	RESERVED_HTML_SLUGS,
} from "./constants";
import { UserError } from "../utils/userError";

interface HtmlFileRecord {
	slug: string;
	title: string;
	description: string;
	r2_key: string;
	public_path: string;
	updated_at: string;
	created_at: string;
}

function recordToSummary(row: HtmlFileRecord): HtmlFileSummary {
	return {
		slug: row.slug,
		title: row.title,
		description: row.description || "",
		publicPath: row.public_path,
		updatedAt: row.updated_at,
		createdAt: row.created_at,
	};
}

export function normalizeHtmlFileSlug(input: string) {
	const slug = input.trim().replace(/\.html$/i, "");
	if (!slug) throw new UserError("文件名不能为空");
	if (!HTML_FILE_SLUG_RE.test(slug))
		throw new UserError("文件名仅支持字母、数字与连字符，且需以字母或数字开头");
	if (RESERVED_HTML_SLUGS.has(slug)) throw new UserError("该文件名已被系统保留");
	return slug;
}

/** 解析 API 路径中的 slug，拒绝多段路径与路径穿越 */
export function parseHtmlFileSlugParam(segments: string[]) {
	if (segments.length !== 1) throw new UserError("路径无效");
	const raw = decodeURIComponent(segments[0]);
	if (!raw || raw.includes("/") || raw.includes("\\") || raw.includes(".."))
		throw new UserError("路径无效");
	return normalizeHtmlFileSlug(raw);
}

export function normalizeHtmlFilePayload(
	raw: HtmlFileUpsertPayload,
): HtmlFileUpsertPayload {
	const slug = normalizeHtmlFileSlug(raw.slug);
	const title = String(raw.title || "").trim();
	const description = String(raw.description || "").trim();
	const content = String(raw.content ?? "");

	if (!title) throw new UserError("标题不能为空");
	if (!content.trim()) throw new UserError("HTML 内容不能为空");

	return {
		slug,
		title,
		description,
		content,
	};
}

export async function listHtmlFiles(
	env: CloudflareEnv,
): Promise<HtmlFileSummary[]> {
	const { results } = await env.DB.prepare(`
    SELECT *
    FROM html_files
    ORDER BY updated_at DESC, slug ASC
  `).all<HtmlFileRecord>();

	return (results || []).map(recordToSummary);
}

export async function getHtmlFile(
	env: CloudflareEnv,
	slugInput: string,
): Promise<HtmlFileDetail | null> {
	const slug = normalizeHtmlFileSlug(slugInput);
	const row = await env.DB.prepare("SELECT * FROM html_files WHERE slug = ?")
		.bind(slug)
		.first<HtmlFileRecord>();

	if (!row) return null;

	const object = await env.BUCKET.get(row.r2_key);
	if (!object) return null;

	const content = await object.text();
	return {
		...recordToSummary(row),
		content,
	};
}

export async function upsertHtmlFile(
	env: CloudflareEnv,
	raw: HtmlFileUpsertPayload,
): Promise<HtmlFileDetail> {
	const payload = normalizeHtmlFilePayload(raw);
	const r2Key = htmlFileR2Key(payload.slug);
	const publicPath = htmlFilePublicPath(payload.slug);

	await env.BUCKET.put(r2Key, payload.content, {
		httpMetadata: { contentType: "text/html; charset=utf-8" },
	});

	await env.DB.prepare(`
    INSERT INTO html_files (slug, title, description, r2_key, public_path, updated_at, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      r2_key = excluded.r2_key,
      public_path = excluded.public_path,
      updated_at = datetime('now')
  `)
		.bind(
			payload.slug,
			payload.title,
			payload.description || "",
			r2Key,
			publicPath,
		)
		.run();

	const detail = await getHtmlFile(env, payload.slug);
	if (!detail) throw new UserError("保存 HTML 文件失败");

	return detail;
}

export async function deleteHtmlFile(
	env: CloudflareEnv,
	slugInput: string,
): Promise<boolean> {
	const slug = normalizeHtmlFileSlug(slugInput);
	const row = await env.DB.prepare("SELECT * FROM html_files WHERE slug = ?")
		.bind(slug)
		.first<HtmlFileRecord>();

	if (!row) return false;

	await env.BUCKET.delete(row.r2_key);
	await env.DB.prepare("DELETE FROM html_files WHERE slug = ?")
		.bind(slug)
		.run();
	return true;
}

export async function serveHtmlFileByPath(
	env: CloudflareEnv,
	pathname: string,
): Promise<Response | null> {
	const normalized = pathname.replace(/\/+$/, "");
	if (!normalized.endsWith(".html")) return null;

	const segments = normalized.split("/").filter(Boolean);
	if (segments.length !== 1) return null;

	let slug = "";
	try {
		slug = normalizeHtmlFileSlug(segments[0].replace(/\.html$/i, ""));
	} catch {
		return null;
	}

	const row = await env.DB.prepare("SELECT * FROM html_files WHERE slug = ?")
		.bind(slug)
		.first<HtmlFileRecord>();

	if (!row) return null;

	const object = await env.BUCKET.get(row.r2_key);
	if (!object) return null;

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("Content-Type", "text/html; charset=utf-8");
	headers.set(
		"Cache-Control",
		"public, max-age=60, stale-while-revalidate=300",
	);

	return new Response(object.body, {
		status: 200,
		headers,
	});
}
