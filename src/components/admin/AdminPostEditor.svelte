<script lang="ts">
import { onDestroy, onMount, tick } from "svelte";
import "vditor/dist/index.css";
import { pinyin } from "pinyin-pro";
import type Vditor from "vditor";
import { observeVditorTheme, syncVditorTheme } from "@/lib/adminVditor";

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
		const resp = await fetch(`/api/posts/${encodeURIComponent(slug)}/`);
		if (!resp.ok) throw new Error("文章不存在");
		const post = await resp.json();
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

async function save() {
	saving = true;
	message = "";
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
		const resp = await fetch(`/api/posts/${encodeURIComponent(slug)}/`, {
			method: "PUT",
			headers: { "Content-Type": "text/markdown" },
			body: source,
		});
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			message = data.message || "保存失败";
			messageKind = "err";
			return;
		}
		message = "已保存";
		messageKind = "ok";
		// 更新 slug（若为新文章则跳转到编辑页）
		if (isNew && data.slug && data.slug !== slug) {
			history.replaceState({}, "", `/admin/posts/edit/${encodeURIComponent(data.slug)}/`);
			slug = data.slug;
			isNew = false;
		}
		setTimeout(() => (message = ""), 2200);
	} catch {
		message = "网络错误";
		messageKind = "err";
	} finally {
		saving = false;
	}
}

onMount(load);
onDestroy(() => vditorThemeObserver?.disconnect());
</script>

<div class="pe-page">
	<div class="pe-head">
		<div class="pe-head-info">
			<h2>{isNew ? "新建文章" : `编辑文章`}</h2>
			<p class="pe-sub">{isNew ? "填写标题与正文即可发布" : `slug：${slug}`}</p>
		</div>
		<div class="pe-actions">
			{#if message}
				<span class="pe-msg {messageKind}">{message}</span>
			{/if}
			<a class="btn-secondary" href="/admin/posts/">返回列表</a>
			<button class="btn-primary" on:click={save} disabled={saving}>
				{saving ? "保存中…" : "保存"}
			</button>
		</div>
	</div>

	{#if loaded}
		<div class="pe-grid">
			<div class="pe-main">
				<div class="pe-card editor-card">
					<div id="vditor-editor"></div>
				</div>
			</div>

			<div class="pe-side">
				<div class="pe-card">
					<h3 class="card-title">内容属性</h3>
					<label>
						<span>标题 *</span>
						<input
							type="text"
							bind:value={title}
							placeholder="文章标题"
							on:input={() => {
								if (isNew && !slugManuallyEdited) slug = slugifyTitle(title);
							}}
						/>
					</label>
					<label>
						<span>Slug（URL 标识）</span>
						<input
							type="text"
							bind:value={slug}
							disabled={!isNew}
							placeholder="english-slug"
							on:input={() => {
								slugManuallyEdited = true;
							}}
						/>
					</label>
					<div class="row2">
						<label>
							<span>发布日期 *</span>
							<input type="date" bind:value={published} />
						</label>
						<label>
							<span>更新日期</span>
							<input type="date" bind:value={updated} />
						</label>
					</div>
					<label>
						<span>分类</span>
						<input type="text" bind:value={category} placeholder="如 技术" />
					</label>
					<label>
						<span>标签（逗号分隔）</span>
						<input type="text" bind:value={tagsText} placeholder="Astro, Cloudflare" />
					</label>
					<label>
						<span>封面图 URL</span>
						<input type="text" bind:value={image} placeholder="https://… 或 /path" />
					</label>
				</div>

				<div class="pe-card">
					<h3 class="card-title">发布状态</h3>
					<label class="switch-line">
						<input type="checkbox" bind:checked={draft} />
						草稿（不发布）
					</label>
					<label class="switch-line">
						<input type="checkbox" bind:checked={pinned} />
						置顶
					</label>
					<label class="switch-line">
						<input type="checkbox" bind:checked={comment} />
						允许评论
					</label>
				</div>

				<div class="pe-card">
					<h3 class="card-title">扩展设置</h3>
					<div class="row2">
						<label>
							<span>系列</span>
							<input type="text" bind:value={series} />
						</label>
						<label>
							<span>序号</span>
							<input type="number" bind:value={seriesOrder} />
						</label>
					</div>
					<label>
						<span>访问密码（加密文章）</span>
						<input type="text" bind:value={password} />
					</label>
					<label>
						<span>密码提示</span>
						<input type="text" bind:value={passwordHint} />
					</label>
				</div>
			</div>
		</div>
	{:else}
		<div class="pe-loading">{message || "加载中…"}</div>
	{/if}
</div>

<style>
	.pe-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 1280px;
		margin: 0 auto;
	}
	.pe-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.pe-head h2 {
		margin: 0;
		font-size: 1.12rem;
		font-weight: 700;
		color: var(--deep-text);
	}
	.pe-sub {
		margin: 0.2rem 0 0;
		font-size: 0.82rem;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 60vw;
	}
	.pe-actions {
		display: flex;
		align-items: center;
		gap: 0.55rem;
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




	.pe-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		align-items: start;
	}
	.pe-card {
		background: var(--card-bg);
		border: 1px solid var(--line-divider);
		border-radius: 0.9rem;
		padding: 1.1rem 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.card-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--deep-text);
		padding-bottom: 0.55rem;
		border-bottom: 1px solid var(--line-divider);
	}
	.editor-card {
		padding: 1rem 1rem 0.8rem;
	}
	.pe-card label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.82rem;
		color: var(--text-muted);
		min-width: 0;
	}
	.pe-card input {
		padding: 0.48rem 0.65rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--deep-text);
		font-size: 0.88rem;
		width: 100%;
		box-sizing: border-box;
	}
	.pe-card input:disabled {
		opacity: 0.55;
	}
	.row2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.7rem;
	}
	.switch-line {
		flex-direction: row !important;
		align-items: center;
		gap: 0.5rem !important;
		cursor: pointer;
		font-size: 0.88rem !important;
		color: var(--deep-text) !important;
	}
	.switch-line input {
		width: auto;
	}
	.pe-loading {
		padding: 3rem;
		text-align: center;
		color: var(--text-muted);
	}

	@media (min-width: 1024px) {
		.pe-grid {
			grid-template-columns: minmax(0, 1fr) 330px;
		}
	}
	@media (max-width: 767px) {
		.row2 {
			grid-template-columns: 1fr;
		}
	}
</style>
