import type {
	NoticeBoard,
	NoticeLine,
	NoticeLineInput,
	NoticeSection,
} from "../../types/notice";
import { UserError } from "../utils/userError";

function normalizeLine(line: NoticeLineInput): NoticeLine | null {
	if (typeof line === "string") {
		const text = line.trim();
		return text ? { text } : null;
	}

	const text = String(line.text || "").trim();
	if (!text) return null;

	const url = line.url ? String(line.url).trim() : undefined;
	return url ? { text, url } : { text };
}

export function normalizeSections(
	input: Array<{ label?: string; lines?: NoticeLineInput[] }> | undefined,
): NoticeSection[] {
	if (!Array.isArray(input)) return [];

	return input
		.map((section) => {
			const label = String(section.label || "").trim();
			const lines = (section.lines || [])
				.map((line) => normalizeLine(line))
				.filter((line): line is NoticeLine => Boolean(line));

			if (!label && !lines.length) return null;

			return {
				label: label || "分组",
				lines,
			};
		})
		.filter((section): section is NoticeSection => Boolean(section));
}

export function normalizeNoticeBoard(
	input: Partial<NoticeBoard> | null | undefined,
): NoticeBoard {
	return {
		title: String(input?.title || "公告栏").trim() || "公告栏",
		sections: normalizeSections(input?.sections),
	};
}

export function parseNoticePayload(raw: string): NoticeBoard {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		// 输入不是合法 JSON：这是客户端请求错误（400），而非服务器内部错误（500）。
		throw new UserError("公告内容格式无效，需为 JSON 格式 { title, sections }");
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
		throw new UserError("公告内容格式无效，需为 JSON 对象 { title, sections }");
	return normalizeNoticeBoard(parsed as Partial<NoticeBoard>);
}
