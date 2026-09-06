<script lang="ts">
import { onDestroy, onMount, tick } from "svelte";
import "vditor/dist/index.css";
import { pinyin } from "pinyin-pro";
import type Vditor from "vditor";
import { observeVditorTheme, syncVditorTheme } from "@/lib/adminVditor";
import { apiJson } from "@/lib/adminApi";

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

export let slug = "";
export let isNew = false;

let title = "";
let published = "";
let updated = "";
let category = "";
let tagsText = "";
let description = "";
let image = "";
let password = "";
let passwordHint = "";
let pinned = false;
let draft = false;
let series = "";
let seriesOrder = "";
let comment = true;
let rawContent = "";

let editor: Vditor | null = null;
let vditorThemeObserver: MutationObserver | null = null;
let saving = false;
let message = "";
let messageKind: "ok" | "err" = "ok";
let loaded = false;
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
			frontmatter?: Record<string, unknown>;
		}>(`/api/posts/${encodeURIComponent(slug)}/`);
		const fm = post.frontmatter || {};
		title = post.title;
		published = String(fm.published || post.date || "");
		updated = fm.updated ? String(fm.updated) : "";
		category = String(fm.category || post.categories?.[0] || "");
		tagsText = Array.isArray(post.tags) ? post.tags.join(", ") : "";
		description = post.description || "";
		image = fm.image || post.cover || "";
		password = fm.password || "";
		passwordHint = fm.passwordHint || "";
		pinned = fm.pinned === true || (post.pin_order ?? 0) > 0;
		draft = fm.draft === true;
		series = String(fm.series || "");
		seriesOrder = fm.seriesOrder != null ? String(fm.seriesOrder) : "";
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

	const { default: Vditor } = await import("vditor");
	editor = new Vditor("vditor-editor", {
		height: 560,
		// 富文本（所见即所得）为默认编辑模式；可在编辑器内切换到 IR/分屏 Markdown
		mode: "wysiwyg",
		value: rawContent,

		cdn: "/vditor",
		cache: { enable: false },
		upload: {
			url: "/api/admin/upload-image/",
			fieldName: "file",
			headers: {},
		},
		after: () => {
			const root = document.querySelector<HTMLElement>(".vditor");
			if (root) {
				syncVditorTheme(root);
				vditorThemeObserver = observeVditorTheme(root);
			}
		},
	});
}

function buildFrontmatter(): Record<string, unknown> {
	const fm: Record<string, unknown> = {
		title,
		published,
		tags: tagsText
			.split(/[,，]/)
			.map((t) => t.trim())
			.filter(Boolean),
		pinned,
		draft,
		comment,
	};

	if (category.trim()) fm.category = category.trim();
	if (updated) fm.updated = updated;
	if (description.trim()) fm.description = description.trim();
	if (image.trim()) fm.image = image.trim();
	if (password.trim()) fm.password = password.trim();
	if (passwordHint.trim()) fm.passwordHint = passwordHint.trim();
	if (series.trim()) {
		fm.series = series.trim();
		if (seriesOrder.trim()) fm.seriesOrder = Number(seriesOrder);
	}
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
		return;
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
		const data = await apiJson<{ ok?: boolean; slug?: string; message?: string }>(
			`/api/posts/${encodeURIComponent(slug)}/`,
			{
				method: "PUT",
				headers: { "Content-Type": "text/markdown" },
				body: source,
			},
		);
		if (!data.ok) {
			message = data.message || "保存失败";
			messageKind = "err";
			return;
		}
		message = targetDraft ? "已保存草稿" : "已发布";
		messageKind = "ok";
		if (isNew && data.slug && data.slug !== slug) {
			history.replaceState({}, "", `/admin/posts/edit/${encodeURIComponent(data.slug)}/`);
			slug = data.slug;
			isNew = false;
		}
		setTimeout(() => (message = ""), 2200);
	} catch (e) {
		message = e instanceof Error ? e.message : "网络错误";
		messageKind = "err";
	} finally {
		saving = false;
	}
}

onMount(load);
onDestroy(() => vditorThemeObserver?.disconnect());
</script>

<div class="crud-page" style="max-width:none">
	<div class="crud-head">
		<div>
			<h2>{isNew ? "新建文章" : "编辑文章"}</h2>
			<p class="crud-sub">
				<a href="/admin/posts/" class="muted">← 返回文章列表</a>
			</p>
		</div>
		<div class="crud-head-actions">
			{#if message}
				<span class="pe-msg {messageKind}">{message}</span>
			{/if}
			<button class="btn btn-ghost" on:click={() => save(true)} disabled={saving}>
				保存草稿
			</button>
			<button class="btn btn-primary" on:click={() => save(false)} disabled={saving}>
				{saving ? "保存中…" : "发布"}
			</button>
		</div>
	</div>

	{#if loaded}
		<div class="editor-layout">
			<div>
				<div class="card editor-title" style="padding:.8rem">
					<input
						placeholder="文章标题（必填）"
						bind:value={title}
						on:input={() => {
							if (isNew && !slugManuallyEdited) slug = slugifyTitle(title);
						}}
					/>
				</div>
				<div class="card editor-body">
					<div id="vditor-editor"></div>
				</div>
			</div>

			<div class="side-stack">
				<div class="card">
					<h3 class="panel-title">发布设置</h3>
					<div class="stack-fields">
						<label class="crud-field">
							<span>分类</span>
							<input type="text" bind:value={category} placeholder="如 技术" />
						</label>
						<label class="crud-field">
							<span>标签（逗号分隔）</span>
							<input type="text" bind:value={tagsText} placeholder="Astro, Cloudflare" />
						</label>
						<label class="crud-field">
							<span>自定义链接（slug）</span>
							<input
								type="text"
								bind:value={slug}
								disabled={!isNew}
								placeholder="english-slug"
								on:input={() => (slugManuallyEdited = true)}
							/>
						</label>
						<label class="check-line">
							<button class="sw" class:on={pinned} aria-label="置顶开关" on:click={() => (pinned = !pinned)}></button>
							<span class="check-text">置顶</span>
						</label>
					</div>
				</div>

				<div class="card">
					<h3 class="panel-title">内容与封面</h3>
					<div class="stack-fields">
						<div class="row2">
							<label class="crud-field">
								<span>发布日期 *</span>
								<input type="date" bind:value={published} />
							</label>
							<label class="crud-field">
								<span>更新日期</span>
								<input type="date" bind:value={updated} />
							</label>
						</div>
						<label class="crud-field">
							<span>简介 / 描述</span>
							<input type="text" bind:value={description} placeholder="用于列表与 SEO" />
						</label>
						<label class="crud-field">
							<span>封面图 URL</span>
							<input type="text" bind:value={image} placeholder="https://… 或 /path" />
						</label>
					</div>
				</div>

				<div class="card">
					<h3 class="panel-title">扩展设置</h3>
					<div class="stack-fields">
						<div class="row2">
							<label class="crud-field">
								<span>系列</span>
								<input type="text" bind:value={series} />
							</label>
							<label class="crud-field">
								<span>序号</span>
								<input type="number" bind:value={seriesOrder} />
							</label>
						</div>
						<label class="crud-field">
							<span>访问密码（加密文章）</span>
							<input type="text" bind:value={password} />
						</label>
						<label class="crud-field">
							<span>密码提示</span>
							<input type="text" bind:value={passwordHint} />
						</label>
						<label class="check-line">
							<button class="sw" class:on={comment} aria-label="评论开关" on:click={() => (comment = !comment)}></button>
							<span class="check-text">允许评论</span>
						</label>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="pe-loading">{message || "加载中…"}</div>
	{/if}
</div>

<style>
	.stack-fields {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}
	.row2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.7rem;
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
	.editor-body {
		margin-top: 1rem;
		padding: 1rem 1rem 0.8rem;
		max-width: 100%;
		overflow-x: auto;
	}
	.editor-body :global(.vditor) {
		max-width: 100%;
	}
	.pe-loading {
		padding: 3rem;
		text-align: center;
		color: var(--text-muted);
	}
	@media (max-width: 1023px) {
		.row2 {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 767px) {
		.crud-head {
			flex-direction: column;
			align-items: flex-start;
		}
		.crud-head-actions {
			width: 100%;
		}
		.editor-body :global(.vditor-toolbar) {
			flex-wrap: wrap;
		}
	}
</style>
