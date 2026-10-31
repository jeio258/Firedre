<script lang="ts">
import { pinyin } from "pinyin-pro";
import { onDestroy, onMount, tick } from "svelte";
import type Vditor from "vditor";
import { apiJson } from "@/lib/adminApi";
import { clearDraft, getDraft } from "@/lib/adminDrafts";
import { registerSaveAll } from "@/lib/adminSave";
import { createAdminVditor } from "@/lib/adminVditor";
import { onMountAsync } from "@/utils/svelte-mount";
import Switch from "./Switch.svelte";

function slugifyTitle(title: string): string {
	if (!title) return "";
	const segments = title.split(/([\u4e00-\u9fa5]+)/).filter(Boolean);
	const parts: string[] = [];
	for (const seg of segments) {
		if (/^[\u4e00-\u9fa5]+$/.test(seg)) {
			const py = pinyin(seg, { toneType: "none", type: "array" });
			parts.push(py.join("-"));
		} else {
			const cleaned = seg
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "");
			if (cleaned) parts.push(cleaned);
		}
	}
	return parts.filter(Boolean).join("-").replace(/-{2,}/g, "-");
}

// categories/tags 在后端可能是数组、JSON 串（D1 列）或逗号串（旧 frontmatter），
// 与服务端 normalizeTags 同口径归一为去空字符串数组
function parseStringList(value: unknown): string[] {
	if (value == null) return [];
	if (Array.isArray(value)) {
		return value.map((v) => String(v).trim()).filter(Boolean);
	}
	const raw = String(value).trim();
	if (!raw) return [];
	if (raw.startsWith("[")) {
		try {
			return parseStringList(JSON.parse(raw));
		} catch {}
	}
	return raw
		.split(/[,，]/)
		.map((v) => v.trim())
		.filter(Boolean);
}

interface CategoryNode {
	name: string;
	children?: CategoryNode[];
}

function appendTokens(current: string[], raw: string): string[] {
	const next = [...current];
	for (const token of raw
		.split(/[,，]/)
		.map((t) => t.trim())
		.filter(Boolean)) {
		if (!next.some((v) => v.toLowerCase() === token.toLowerCase()))
			next.push(token);
	}
	return next;
}

let {
	slug: initialSlug = "",
	isNew: initialIsNew = false,
}: { slug?: string; isNew?: boolean } = $props();

let title = $state("");
let published = $state("");
let updated = $state("");
let categories = $state<string[]>([]);
let categoryInput = $state("");
let tags = $state<string[]>([]);
let tagInput = $state("");
let description = $state("");
let image = $state("");
let password = $state("");
let passwordHint = $state("");
let pinned = $state(false);
let draft = $state(false);
let hidden = $state(false);
let series = $state("");
let seriesOrder = $state("");
let sourceLink = $state("");
let comment = $state(true);
let rawContent = $state("");
let slug = $state(initialSlug);
let isNew = $state(initialIsNew);

let editor: Vditor | null = null;
let vditorThemeObserver: MutationObserver | null = null;
let saving = $state(false);
let message = $state("");
let messageKind = $state<"ok" | "err">("ok");
let loaded = $state(false);
let drawerOpen = $state(false);
let categorySuggestions = $state<string[]>([]);
// 封面模式：auto=交给站点随机封面；manual=用下方图片地址
let coverAuto = $state(true);
let fetchingCover = $state(false);
const AUTO_COVER_KEY = "admin:autoCover";

let availableCategories = $derived(
	categorySuggestions.filter((path) =>
		path
			.split("/")
			.every(
				(seg) => !categories.some((c) => c.toLowerCase() === seg.toLowerCase()),
			),
	),
);

/**
 * 自动获取封面图（A+B）：
 * - force=false（新建且封面为空）：站点开启随机封面时写主题魔法值 `api`（每次访问随机、
 *   主题自带多 API 兜底），否则写服务端解析出的具体图片地址
 * - force=true（编辑页主动更换）：总是取具体地址，保证真的换一张
 */
async function applyAutoCover(force: boolean) {
	if (!force && image.trim()) return;
	fetchingCover = true;
	try {
		const data = await apiJson<{ enable: boolean; url: string }>(
			"/api/admin/random-cover/",
		);
		if (!force && data.enable) {
			image = "api";
		} else if (data.url) {
			image = data.url;
		} else if (data.enable) {
			image = "api";
		} else {
			message = "随机图 API 获取失败，请检查后台「功能配置 → 封面」的 API 列表";
			messageKind = "err";
			return;
		}
		message = "已自动获取封面图";
		messageKind = "ok";
	} catch (e) {
		message = e instanceof Error ? e.message : "获取封面图失败";
		messageKind = "err";
	} finally {
		fetchingCover = false;
	}
}

function persistCoverMode(auto: boolean) {
	try {
		localStorage.setItem(AUTO_COVER_KEY, auto ? "1" : "0");
	} catch {}
}

function useAutoCover() {
	coverAuto = true;
	persistCoverMode(true);
	void applyAutoCover(true);
}

function useManualCover() {
	coverAuto = false;
	persistCoverMode(false);
	// 魔法值 `api` 只能由站点解析，切手动时清掉，等用户填具体地址
	if (image === "api") image = "";
}

function addCategory(raw: string) {
	categories = appendTokens(categories, raw);
	categoryInput = "";
}

function removeCategory(value: string) {
	categories = categories.filter((c) => c !== value);
}

function addTag(raw: string) {
	tags = appendTokens(tags, raw);
	tagInput = "";
}

function removeTag(value: string) {
	tags = tags.filter((t) => t !== value);
}

function onChipKeydown(
	e: KeyboardEvent,
	kind: "category" | "tag",
	value: string,
) {
	const list = kind === "category" ? categories : tags;
	if (e.key === "Enter" || e.key === "," || e.key === "，") {
		e.preventDefault();
		if (kind === "category") addCategory(value);
		else addTag(value);
	} else if (e.key === "Backspace" && !value && list.length) {
		if (kind === "category") categories = categories.slice(0, -1);
		else tags = tags.slice(0, -1);
	}
}

async function loadCategorySuggestions() {
	try {
		const data = await apiJson<{ categories: CategoryNode[] }>(
			"/api/posts/taxonomy/categories/",
		);
		const flat: string[] = [];
		const walk = (nodes: CategoryNode[], prefix: string) => {
			for (const node of nodes) {
				const path = prefix ? `${prefix}/${node.name}` : node.name;
				flat.push(path);
				if (node.children?.length) walk(node.children, path);
			}
		};
		walk(data.categories || [], "");
		categorySuggestions = flat.filter((p) => p !== "Uncategorized");
	} catch {
		categorySuggestions = [];
	}
}

let slugManuallyEdited = false;

async function load() {
	if (isNew) {
		published = new Date().toISOString().slice(0, 10);
		loaded = true;

		await tick();
		initEditor();
		return;
	}
	try {
		const post = await apiJson<{
			title: string;
			date?: string;
			categories?: string[];
			tags?: string[];
			description?: string;
			cover?: string;
			markdown?: string;
			pin_order?: number;
			frontmatter?: Record<string, unknown>;
		}>(`/api/posts/${encodeURIComponent(slug)}/`);
		const fm = post.frontmatter || {};
		title = post.title;
		published = String(fm.published || post.date || "");
		updated = fm.updated ? String(fm.updated) : "";
		const loadedCategories = parseStringList(fm.categories);
		const fallbackCategories = parseStringList(post.categories);
		categories = loadedCategories.length
			? loadedCategories
			: fallbackCategories.length
				? fallbackCategories
				: parseStringList(fm.category);
		const loadedTags = parseStringList(fm.tags);
		tags = loadedTags.length ? loadedTags : parseStringList(post.tags);
		description = post.description || "";
		image = (fm.image as string | undefined) || post.cover || "";
		coverAuto = !image.trim() || image.trim() === "api";
		password = (fm.password as string | undefined) || "";
		passwordHint = (fm.passwordHint as string | undefined) || "";
		pinned = fm.pinned === true || (post.pin_order ?? 0) > 0;
		draft = fm.draft === true;
		hidden = fm.hidden === true;
		series = String(fm.series || "");
		seriesOrder = fm.seriesOrder != null ? String(fm.seriesOrder) : "";
		sourceLink = String(fm.sourceLink || "");
		comment = fm.comment !== false;
		rawContent = post.markdown || "";
		loaded = true;
		await tick();
		initEditor();
	} catch (e) {
		message = e instanceof Error ? e.message : "加载失败";
		messageKind = "err";
	}
}

async function initEditor() {
	if (editor) {
		editor.setValue(rawContent);
		return;
	}

	editor = await createAdminVditor("vditor-editor", {
		value: rawContent,
		height: 560,
		upload: {
			url: "/api/admin/upload-image/",
			fieldName: "file",
			headers: {},
		},
		onThemeObserver: (mo) => (vditorThemeObserver = mo),
	});
}

function buildFrontmatter(): Record<string, unknown> {
	const fm: Record<string, unknown> = {
		title,
		published,
		categories,
		tags,
		pinned,
		draft,
		comment,
	};

	if (hidden) fm.hidden = true;
	if (updated) fm.updated = updated;
	if (description.trim()) fm.description = description.trim();
	if (image.trim()) fm.image = image.trim();
	if (password.trim()) fm.password = password.trim();
	if (passwordHint.trim()) fm.passwordHint = passwordHint.trim();
	if (series.trim()) {
		fm.series = series.trim();
		if (seriesOrder.trim()) fm.seriesOrder = Number(seriesOrder);
	}
	if (sourceLink.trim()) fm.sourceLink = sourceLink.trim();
	return fm;
}

async function save(targetDraft: boolean) {
	saving = true;
	message = "";
	draft = targetDraft;
	const content = editor ? editor.getValue() : rawContent;
	if (!title.trim() || !content.trim()) {
		message = "标题与正文不能为空";
		messageKind = "err";
		saving = false;
		return false;
	}
	const fm = buildFrontmatter();
	const source = `---\n${Object.entries(fm)
		.map(([key, value]) => {
			if (Array.isArray(value))
				return `${key}: [${(value as string[]).map((v) => `"${v}"`).join(", ")}]`;
			return `${key}: ${JSON.stringify(value)}`;
		})
		.join("\n")}\n---\n\n${content}`;

	try {
		const data = await apiJson<{
			ok?: boolean;
			slug?: string;
			message?: string;
		}>(`/api/posts/${encodeURIComponent(slug)}/`, {
			method: "PUT",
			headers: { "Content-Type": "text/markdown" },
			body: source,
		});
		if (!data.ok) {
			message = data.message || "保存失败";
			messageKind = "err";
			return false;
		}
		message = targetDraft ? "已保存草稿" : hidden ? "已保存（隐藏）" : "已发布";
		messageKind = "ok";
		clearDraft("文章");
		if (isNew && data.slug && data.slug !== slug) {
			history.replaceState(
				{},
				"",
				`/admin/posts/edit/${encodeURIComponent(data.slug)}/`,
			);
			slug = data.slug;
			isNew = false;
		}
		setTimeout(() => (message = ""), 2200);
		return true;
	} catch (e) {
		message = e instanceof Error ? e.message : "网络错误";
		messageKind = "err";
		return false;
	} finally {
		saving = false;
	}
}

onMountAsync(async () => {
	await load();
	void loadCategorySuggestions();
	const d = getDraft<{
		title?: string;
		published?: string;
		updated?: string;
		categories?: string[];
		tags?: string[];
		description?: string;
		image?: string;
		password?: string;
		passwordHint?: string;
		pinned?: boolean;
		draft?: boolean;
		hidden?: boolean;
		series?: string;
		seriesOrder?: string;
		sourceLink?: string;
		comment?: boolean;
		content?: string;
		slug?: string;
		isNew?: boolean;
	}>("文章");
	// 草稿归属校验：恢复需满足「同为新文章」或「同为编辑态且 slug 一致」。
	// 新文章场景 slug 会随标题输入自动生成（挂载时为空），不能作为归属依据；
	// 已存在文章之间靠 slug 区分，防止 A 的未保存内容覆盖 B。
	const sameContext =
		d != null && d.isNew === isNew && (isNew || d.slug === slug);
	if (d && !sameContext) {
		clearDraft("文章");
	} else if (d) {
		if (d.title != null) title = d.title;
		if (d.published != null) published = d.published;
		if (d.updated != null) updated = d.updated;
		if (d.categories != null) categories = d.categories;
		if (d.tags != null) tags = d.tags;
		if (d.description != null) description = d.description;
		if (d.image != null) image = d.image;
		if (d.password != null) password = d.password;
		if (d.passwordHint != null) passwordHint = d.passwordHint;
		if (d.pinned != null) pinned = d.pinned;
		if (d.draft != null) draft = d.draft;
		if (d.hidden != null) hidden = d.hidden;
		if (d.series != null) series = d.series;
		if (d.seriesOrder != null) seriesOrder = d.seriesOrder;
		if (d.sourceLink != null) sourceLink = d.sourceLink;
		if (d.comment != null) comment = d.comment;
		if (d.slug != null) slug = d.slug;
		if (d.isNew != null) isNew = d.isNew;
		if (d.content != null) {
			rawContent = d.content;
			if (editor) editor.setValue(d.content);
		}
		clearDraft("文章");
	}
	// 封面偏好：仅新建时按上次选择决定模式，再按需自动取图（编辑页以文章自身封面为准）
	try {
		if (isNew) coverAuto = localStorage.getItem(AUTO_COVER_KEY) !== "0";
	} catch {}
	if (coverAuto && isNew && !image.trim()) void applyAutoCover(false);
	return registerSaveAll(
		"文章",
		() => save(draft),
		() => ({
			title,
			published,
			updated,
			categories,
			tags,
			description,
			image,
			password,
			passwordHint,
			pinned,
			draft,
			hidden,
			series,
			seriesOrder,
			sourceLink,
			comment,
			content: editor ? editor.getValue() : rawContent,
			slug,
			isNew,
		}),
	);
});
onDestroy(() => vditorThemeObserver?.disconnect());
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === "Escape" && drawerOpen) drawerOpen = false;
	}}
/>

<div class="pe-page">
	<header class="pe-head">
		<div class="pe-head-main">
			<a href="/admin/posts/" class="pe-back">← 返回文章列表</a>
			<h2>{isNew ? "新建文章" : "编辑文章"}</h2>
		</div>
		<div class="pe-head-actions">
			{#if message}
				<span class="pe-msg {messageKind}">{message}</span>
			{/if}
			<button class="btn btn-ghost" type="button" onclick={() => (drawerOpen = true)}>
				设置
			</button>
			<button class="btn btn-ghost" onclick={() => save(true)} disabled={saving}>
				存草稿
			</button>
			<button class="btn btn-primary" onclick={() => save(false)} disabled={saving}>
				{saving ? "保存中…" : "发布"}
			</button>
		</div>
	</header>

	{#if loaded}
		<main class="pe-paper">
			<input
			 class="pe-title"
				placeholder="文章标题（必填）"
				bind:value={title}
				oninput={() => {
					if (isNew && !slugManuallyEdited) slug = slugifyTitle(title);
				}}
			/>
			<div id="vditor-editor" class="pe-editor"></div>
		</main>
	{:else}
		<div class="pe-loading">{message || "加载中…"}</div>
	{/if}
</div>

<button
	class="pe-backdrop"
	class:open={drawerOpen}
	type="button"
	aria-label="关闭设置"
	tabindex="-1"
	onclick={() => (drawerOpen = false)}
></button>
<aside
	class="pe-drawer"
	class:open={drawerOpen}
	aria-hidden={!drawerOpen}
	aria-label="文章设置"
	inert={!drawerOpen}
>
	<div class="pe-drawer-head">
		<h3>文章设置</h3>
		<button class="pe-drawer-close" type="button" aria-label="关闭设置" onclick={() => (drawerOpen = false)}>
			×
		</button>
	</div>

	<div class="pe-drawer-body">
		<section class="pe-block">
			<h4 class="pe-block-title">发布</h4>
			<label class="ui-field">
				<span class="ui-label">状态</span>
				<select
					 class="ui-input" value={draft ? "draft" : hidden ? "hidden" : "publish"}
					onchange={(e) => {
						const value = e.currentTarget.value;
						draft = value === "draft";
						hidden = value === "hidden";
					}}
				>
					<option value="publish">发布</option>
					<option value="draft">草稿</option>
					<option value="hidden">隐藏</option>
				</select>
			</label>
			<div class="row2">
				<label class="ui-field">
					<span class="ui-label">发布日期</span>
					<input  class="ui-input" type="date" bind:value={published} />
				</label>
				<label class="ui-field">
					<span class="ui-label">更新日期</span>
					<input  class="ui-input" type="date" bind:value={updated} />
				</label>
			</div>

			<div class="ui-field">
				<span class="ui-label">分类</span>
				<div class="chips">
					{#each categories as category (category)}
						<span class="chip">
							{category}
							<button
								type="button"
								aria-label={`删除分类 ${category}`}
								onclick={() => removeCategory(category)}
							>×</button>
						</span>
					{/each}
					<input
					 class="chip-input"
						placeholder={categories.length ? "继续添加…" : "输入后回车添加"}
						bind:value={categoryInput}
						onkeydown={(e) => onChipKeydown(e, "category", categoryInput)}
						onblur={() => categoryInput.trim() && addCategory(categoryInput)}
					/>
				</div>
				{#if availableCategories.length}
					<div class="suggest">
						<span class="suggest-label">已有分类</span>
						{#each availableCategories as path (path)}
							<button
								type="button"
								onclick={() => path.split("/").forEach((seg) => addCategory(seg))}
							>{path}</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="ui-field">
				<span class="ui-label">标签</span>
				<div class="chips">
					{#each tags as tag (tag)}
						<span class="chip">
							{tag}
							<button
								type="button"
								aria-label={`删除标签 ${tag}`}
								onclick={() => removeTag(tag)}
							>×</button>
						</span>
					{/each}
					<input
					 class="chip-input"
						placeholder={tags.length ? "继续添加…" : "输入后回车添加"}
						bind:value={tagInput}
						onkeydown={(e) => onChipKeydown(e, "tag", tagInput)}
						onblur={() => tagInput.trim() && addTag(tagInput)}
					/>
				</div>
			</div>

			<label class="check-line">
				<Switch on={pinned} label="置顶开关" toggle={() => (pinned = !pinned)} />
				<span class="check-text">置顶</span>
			</label>
			<label class="check-line">
				<Switch on={comment} label="评论开关" toggle={() => (comment = !comment)} />
				<span class="check-text">允许评论</span>
			</label>

			<label class="ui-field">
				<span class="ui-label">固定链接（slug）</span>
				<input
					 class="ui-input" type="text"
					bind:value={slug}
					disabled={!isNew}
					placeholder="english-slug"
					oninput={() => (slugManuallyEdited = true)}
				/>
			</label>
		</section>

		<section class="pe-block">
			<h4 class="pe-block-title">封面</h4>
			<div class="pe-cover">
				<div class="pe-cover-thumb">
					{#if image.trim() && image.trim() !== "api"}
						<img src={image.trim()} alt="封面预览" />
					{:else}
						<span class="pe-cover-empty">由站点自动生成</span>
					{/if}
				</div>
				<div class="pe-cover-meta">
					<p class="pe-cover-kind">{coverAuto ? "由站点自动生成" : "手动指定"}</p>
					<p class="pe-cover-note">
						{coverAuto
							? "取自后台「功能配置 → 封面」的随机图 API，每次渲染随机出图。"
							: "使用下方图片地址；留空则由站点自动生成。"}
					</p>
				</div>
			</div>
			{#if !coverAuto}
				<label class="ui-field">
					<span class="ui-label">封面图地址</span>
					<input  class="ui-input" type="text" bind:value={image} placeholder="https://… 或 /path" />
				</label>
			{/if}
			<div class="pe-cover-actions">
				<button
					class="btn btn-ghost"
					type="button"
					onclick={useAutoCover}
					disabled={fetchingCover}
				>{fetchingCover ? "获取中…" : "换一张"}</button>
				<button
					class="btn btn-ghost"
					type="button"
					onclick={useManualCover}
					disabled={!coverAuto}
				>改用手动</button>
			</div>
		</section>

		<section class="pe-block">
			<h4 class="pe-block-title">简介</h4>
			<label class="ui-field">
				<span class="ui-label">简介 / 描述</span>
				<textarea rows="4" bind:value={description} placeholder="用于列表与 SEO"
				></textarea>
			</label>
		</section>

		<section class="pe-block">
			<details class="pe-more">
				<summary>更多</summary>
				<div class="pe-more-body">
					<div class="row2">
						<label class="ui-field">
							<span class="ui-label">系列</span>
							<input  class="ui-input" type="text" bind:value={series} />
						</label>
						<label class="ui-field">
							<span class="ui-label">序号</span>
							<input  class="ui-input" type="number" bind:value={seriesOrder} />
						</label>
					</div>
					<label class="ui-field">
						<span class="ui-label">访问密码（加密文章）</span>
						<input  class="ui-input" type="text" bind:value={password} />
					</label>
					<label class="ui-field">
						<span class="ui-label">密码提示</span>
						<input  class="ui-input" type="text" bind:value={passwordHint} />
					</label>
					<label class="ui-field">
						<span class="ui-label">原文链接</span>
						<input  class="ui-input" type="text" bind:value={sourceLink} placeholder="https://…" />
					</label>
				</div>
			</details>
		</section>
	</div>
</aside>

<style>
	.pe-page {
		display: flex;
		flex-direction: column;
		gap: 1.35rem;
		max-width: 880px;
		margin: 0 auto;
	}
	.pe-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.pe-back {
		font-size: 0.82rem;
		color: var(--text-muted);
		text-decoration: none;
	}
	.pe-back:hover {
		color: var(--primary-text);
	}
	.pe-head h2 {
		margin: 0.4rem 0 0;
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--deep-text);
	}
	.pe-head-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.pe-msg {
		font-size: 0.82rem;
	}
	.pe-msg.ok {
		color: var(--success);
	}
	.pe-msg.err {
		color: var(--danger);
	}

	.pe-paper {
		background: var(--card-bg);
		border: 1px solid var(--line-color);
		border-radius: 16px;
		padding: 40px 46px;
		box-shadow:
			0 1px 2px color-mix(in oklch, var(--line-color) 55%, transparent),
			0 14px 40px color-mix(in oklch, var(--line-color) 40%, transparent);
	}
	.pe-title {
		width: 100%;
		border: 0;
		background: transparent;
		outline: none;
		padding: 0 0 0.9rem;
		font-family: inherit;
		font-size: 32px;
		line-height: 1.25;
		font-weight: 700;
		color: var(--deep-text);
	}
	.pe-title::placeholder {
		color: var(--text-muted);
		font-weight: 500;
	}
	.pe-editor {
		min-width: 0;
	}
	.pe-paper :global(.vditor) {
		border: 0;
		border-radius: 0;
		background: transparent;
		width: 100%;
		max-width: 100%;
		min-width: 0;
	}

	.pe-loading {
		padding: 3rem;
		text-align: center;
		color: var(--text-muted);
	}

	.pe-backdrop {
		position: fixed;
		inset: 0;
		border: 0;
		padding: 0;
		cursor: default;
		background: color-mix(in oklch, var(--deep-text) 32%, transparent);
		opacity: 0;
		visibility: hidden;
		transition:
			opacity var(--duration-medium) var(--ease-standard),
			visibility 0s linear var(--duration-medium);
		z-index: var(--z-modal-backdrop);
	}
	.pe-backdrop.open {
		opacity: 1;
		visibility: visible;
		transition: opacity var(--duration-medium) var(--ease-standard);
	}
	.pe-drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 390px;
		max-width: 100vw;
		display: flex;
		flex-direction: column;
		background: var(--page-bg);
		border-left: 1px solid var(--line-color);
		box-shadow: -10px 0 30px color-mix(in oklch, var(--line-color) 45%, transparent);
		transform: translateX(100%);
		visibility: hidden;
		transition:
			transform var(--duration-slow) var(--ease-standard),
			visibility 0s linear var(--duration-slow);
		z-index: var(--z-modal);
	}
	.pe-drawer.open {
		transform: none;
		visibility: visible;
		transition: transform var(--duration-slow) var(--ease-standard);
	}
	.pe-drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.1rem;
		border-bottom: 1px solid var(--line-color);
	}
	.pe-drawer-head h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: var(--deep-text);
	}
	.pe-drawer-close {
		border: 0;
		background: none;
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		padding: 0.15rem 0.35rem;
		border-radius: 6px;
		color: var(--text-muted);
	}
	.pe-drawer-close:hover {
		color: var(--deep-text);
		background: var(--btn-regular-bg);
	}
	.pe-drawer-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1rem 1.1rem 2rem;
	}

	.pe-block {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--card-bg);
		border: 1px solid var(--line-color);
		border-left: 3px solid var(--primary-fill);
		border-radius: 12px;
		padding: 0.9rem 1rem;
	}
	.pe-block-title {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--deep-text);
	}
	.row2 {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.7rem;
	}
	.row2 > .ui-field {
		min-width: 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		min-height: 2.5rem;
		padding: 0.35rem 0.45rem;
		background: var(--card-bg);
		border: 1px solid var(--line-color);
		border-radius: 10px;
	}
	.chips:focus-within {
		border-color: var(--primary-fill);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.15rem 0.25rem 0.15rem 0.55rem;
		border-radius: 999px;
		background: var(--btn-regular-bg);
		color: var(--deep-text);
		font-size: 0.78rem;
		line-height: 1.5;
	}
	.chip button {
		border: 0;
		background: none;
		cursor: pointer;
		padding: 0 0.2rem;
		font-size: 0.9rem;
		line-height: 1;
		border-radius: 999px;
		color: var(--text-muted);
	}
	.chip button:hover {
		color: var(--danger);
	}
	.chip-input {
		flex: 1 1 7rem;
		min-width: 6rem;
		border: 0;
		outline: none;
		background: transparent;
		font-family: inherit;
		font-size: 0.85rem;
		color: var(--deep-text);
		padding: 0.15rem 0;
	}
	.chip-input::placeholder {
		color: var(--text-muted);
	}
	.suggest {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}
	.suggest-label {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.suggest button {
		border: 1px dashed var(--line-color);
		background: transparent;
		color: var(--text-muted);
		border-radius: 999px;
		padding: 0.1rem 0.5rem;
		font-size: 0.75rem;
		cursor: pointer;
	}
	.suggest button:hover {
		border-color: var(--primary-fill);
		color: var(--primary-text);
	}

	.pe-cover {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}
	.pe-cover-thumb {
		flex: 0 0 auto;
		width: 104px;
		height: 70px;
		border: 1px solid var(--line-color);
		border-radius: 8px;
		background: var(--btn-regular-bg);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.pe-cover-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.pe-cover-empty {
		font-size: 0.7rem;
		color: var(--text-muted);
		text-align: center;
		padding: 0 0.3rem;
	}
	.pe-cover-meta {
		min-width: 0;
	}
	.pe-cover-kind {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--deep-text);
	}
	.pe-cover-note {
		margin: 0.25rem 0 0;
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--text-muted);
	}
	.pe-cover-actions {
		display: flex;
		gap: 0.5rem;
	}

	.pe-more summary {
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--primary-text);
		list-style: none;
	}
	.pe-more summary::-webkit-details-marker {
		display: none;
	}
	.pe-more summary::after {
		content: "▾";
		margin-left: 0.35rem;
		color: var(--text-muted);
	}
	.pe-more[open] summary::after {
		content: "▴";
	}
	.pe-more-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}

	@media (max-width: 1023px) {
		.row2 {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 767px) {
		.pe-paper {
			padding: 24px 20px;
		}
		.pe-title {
			font-size: 26px;
		}
		.pe-drawer {
			width: 100%;
		}
		.pe-head-actions {
			width: 100%;
		}
		.pe-paper :global(.vditor-toolbar) {
			flex-wrap: wrap;
		}
	}
</style>
