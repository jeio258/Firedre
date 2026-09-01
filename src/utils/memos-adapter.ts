
import { Marked } from "marked";

interface MemoAttachment {
	name: string;
	filename: string;
	type: string;
	externalLink: string;
}

interface MemoLocation {
	placeholder?: string;
}

interface Memo {
	name: string;
	state: string;
	creator: string;
	createTime: string;
	updateTime: string;
	content: string;
	visibility: string;
	pinned: boolean;
	attachments: MemoAttachment[];
	location?: MemoLocation;
}

interface MemosApiResponse {
	memos: Memo[];
	nextPageToken: string;
}

export interface DynamicImage {
	alt: string;
	src: string;
	title?: string;
}

export interface DynamicEntry {
	id: string;
	published: number;
	html: string;
	images: DynamicImage[];
	searchText: string;
	pinned?: boolean;
	location?: string;
}

const memosMarked = new Marked({ gfm: true, breaks: true });
import { safeUrlScheme } from "../../server/utils/safeUrl";

memosMarked.use({
	renderer: {
		link({ href, title, tokens }) {
			const text = this.parser.parseInline(tokens);
			const titleAttr = title ? ` title="${String(title).replace(/"/g, "&quot;")}"` : "";

			const safeHref = safeUrlScheme(href);
			if (!safeHref) {
				return `<span>${text}</span>`;
			}
			const escapedHref = String(href).replace(/"/g, "&quot;");
			return `<a href="${escapedHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
		},
		image() {
			return "";
		},
	},
});

function markdownToHtml(markdown: string): string {
	return memosMarked.parse(markdown) as string;
}

function extractPlainText(content: string): string {
	return content
		.replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/[#>*_`~[\]()-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function extractImages(memo: Memo, memosApiUrl: string): DynamicImage[] {
	const images: DynamicImage[] = [];

	// 从 Markdown 内容中提取图片
	const tokens = memosMarked.lexer(memo.content);
	memosMarked.walkTokens(tokens, (token) => {
		if (token.type !== "image") return;
		let src = token.href;
		// 处理相对路径
		if (!src.startsWith("http") && !src.startsWith("//")) {
			src = `${memosApiUrl}${src.startsWith("/") ? "" : "/"}${src}`;
		}
		images.push({
			alt: token.text || "",
			src,
			title: token.title || undefined,
		});
	});

	// 从 Memos 附件中提取图片
	if (memo.attachments) {
		for (const attachment of memo.attachments) {
			if (attachment.type.startsWith("image/")) {

				const attachmentId = attachment.name.split("/").pop() || "";
				const src =
					attachment.externalLink ||
					`${memosApiUrl}/file/attachments/${attachmentId}/${attachment.filename}`;
				images.push({
					alt: attachment.filename,
					src,
					title: attachment.filename,
				});
			}
		}
	}

	return images;
}

// 请求去重缓存，避免同页面多个组件重复请求
const pendingRequests = new Map<string, Promise<DynamicEntry[]>>();

export async function fetchMemos(
	memosApiUrl: string,
	options?: { pageSize?: number; maxPages?: number; parent?: string },
): Promise<DynamicEntry[]> {
	const cacheKey = `${memosApiUrl}:${options?.parent || ""}`;
	const pending = pendingRequests.get(cacheKey);
	if (pending) return pending;

	const promise = fetchMemosInternal(memosApiUrl, options);
	pendingRequests.set(cacheKey, promise);
	promise.finally(() => pendingRequests.delete(cacheKey));
	return promise;
}

async function fetchMemosInternal(
	memosApiUrl: string,
	options?: { pageSize?: number; maxPages?: number; parent?: string },
): Promise<DynamicEntry[]> {
	const pageSize = options?.pageSize || 10000;
	const maxPages = options?.maxPages || 10;
	const parent = options?.parent || "";
	const allMemos: Memo[] = [];
	let pageToken = "";

	for (let page = 0; page < maxPages; page++) {
		const url = new URL(`${memosApiUrl}/api/v1/memos`);
		url.searchParams.set("pageSize", String(pageSize));
		if (parent) {
			url.searchParams.set("parent", parent);
		}
		if (pageToken) {
			url.searchParams.set("pageToken", pageToken);
		}

		const response = await fetch(url.toString(), {
			headers: { Accept: "application/json" },
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "");
			console.error(`[Memos API] ${response.status}: ${errorText}`);
			throw new Error(`Memos API error: ${response.status}`);
		}

		const data: MemosApiResponse = await response.json();
		allMemos.push(...(data.memos || []));

		if (!data.nextPageToken) break;
		pageToken = data.nextPageToken;
	}

	const userFilteredMemos = parent
		? allMemos.filter((memo) => memo.creator === parent)
		: allMemos;

	return userFilteredMemos
		.filter((memo) => memo.state === "NORMAL")
		.map((memo) => {
			const id = memo.name.split("/").pop() || "";
			const published = new Date(memo.createTime).getTime();
			const html = markdownToHtml(memo.content);
			const images = extractImages(memo, memosApiUrl);
			const location = memo.location?.placeholder?.trim() || "";
			const searchText = [extractPlainText(memo.content), location]
				.filter(Boolean)
				.join(" ")
				.toLocaleLowerCase();
			const pinned = memo.pinned || false;

			return {
				id,
				published,
				html,
				images,
				searchText,
				pinned,
				location,
			};
		})
		.sort((a, b) => {
			// 置顶优先，然后按发布时间降序
			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;
			return b.published - a.published;
		});
}
