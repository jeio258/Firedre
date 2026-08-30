<script lang="ts">
import { onMount, tick } from "svelte";
import Vditor from "vditor";
import "vditor/dist/index.css";
import { pinyin } from "pinyin-pro";

/** 根据标题生成拼音 slug（中文转拼音，英文/数字保留，其余清洗为连字符） */
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
let saving = false;
let message = "";
let loaded = false;
let slugManuallyEdited = false;

async function load() {
	if (isNew) {
		published = new Date().toISOString().slice(0, 10);
		loaded = true;
		// 新建文章也必须初始化正文编辑器，否则 #vditor-editor 为空、无正文编辑框
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
	}
}

function initEditor() {
	if (editor) {
		editor.setValue(rawContent);
		return;
	}
	editor = new Vditor("vditor-editor", {
		height: 480,
		mode: "ir",
		value: rawContent,
		// cdn 指向本地 /vditor（资源由 scripts/copy-vditor.mjs 复制到 public/vditor），
		// 避免在线 CDN 网络延迟导致的编辑器加载慢；dev 与生产均可直接使用。
		cdn: "/vditor",
		cache: { enable: false },
		upload: {
			url: "/api/admin/upload-image/",
			fieldName: "file",
			headers: {},
		},
		after: () => {
			// 焦点初始化
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
		category: category.trim() || "未分类",
		pinned,
		draft,
		comment,
	};
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
			return;
		}
		message = "已保存 ✓";
		// 更新 slug（若为新文章则跳转到编辑页）
		if (isNew && data.slug && data.slug !== slug) {
			window.location.href = `/admin/posts/edit/${encodeURIComponent(data.slug)}/`;
		}
	} catch {
		message = "网络错误";
	} finally {
		saving = false;
	}
}

onMount(load);
</script>

<div class="admin-card">
	<div class="toolbar">
		<h2>{isNew ? "新建文章" : `编辑文章：${slug}`}</h2>
		<div class="actions">
			{#if message}
				<span class="msg">{message}</span>
			{/if}
			<button class="btn-primary" on:click={save} disabled={saving}>
				{saving ? "保存中…" : "保存"}
			</button>
			<a class="btn" href="/admin/posts/">返回列表</a>
		</div>
	</div>

	{#if loaded}
		<div class="form-grid">
			<label>
				<span>标题 *</span>
				<input
					type="text"
					bind:value={title}
					on:input={() => {
						// 新文章且用户未手动改过 slug 时，自动根据标题拼音填充
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
			<label>
				<span>发布日期 *</span>
				<input type="date" bind:value={published} />
			</label>
			<label>
				<span>更新日期</span>
				<input type="date" bind:value={updated} />
			</label>
			<label>
				<span>分类</span>
				<input type="text" bind:value={category} />
			</label>
			<label>
				<span>标签（逗号分隔）</span>
				<input type="text" bind:value={tagsText} />
			</label>
			<label class="span2">
				<span>摘要 / 描述</span>
				<textarea rows="2" bind:value={description}></textarea>
			</label>
			<label class="span2">
				<span>封面图 URL（留空用默认）</span>
				<input type="text" bind:value={image} placeholder="https://… 或 /path" />
			</label>
			<label>
				<span>系列</span>
				<input type="text" bind:value={series} />
			</label>
			<label>
				<span>系列序号</span>
				<input type="number" bind:value={seriesOrder} />
			</label>
			<label>
				<span>访问密码（加密文章）</span>
				<input type="text" bind:value={password} />
			</label>
			<label>
				<span>密码提示</span>
				<input type="text" bind:value={passwordHint} />
			</label>
		</div>

		<div class="checks">
			<label><input type="checkbox" bind:checked={pinned} /> 置顶</label>
			<label><input type="checkbox" bind:checked={draft} /> 草稿（不发布）</label>
			<label><input type="checkbox" bind:checked={comment} /> 允许评论</label>
		</div>

		<div id="vditor-editor"></div>
	{:else}
		<p>{message || "加载中…"}</p>
	{/if}
</div>

<style>
	.admin-card {
		background: var(--card-bg, #fff);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: var(--radius-large, 0.75rem);
		padding: 1.25rem;
	}
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		gap: 1rem;
	}
	h2 {
		font-size: 1.1rem;
		margin: 0;
		color: var(--deep-text, inherit);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.msg {
		color: #16a34a;
		font-size: 0.85rem;
	}
	.btn {
		padding: 0.5rem 0.9rem;
		border-radius: 0.4rem;
		text-decoration: none;
		font-size: 0.9rem;
		border: 1px solid var(--line-color, #d1d5db);
		color: var(--deep-text, #374151);
		background: var(--card-bg, #fff);
		cursor: pointer;
	}
	.btn-primary {
		composes: btn;
		background: var(--primary, #5b8cff);
		color: #fff;
		border-color: var(--primary, #5b8cff);
	}
	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.9rem;
		margin-bottom: 1rem;
	}
	.form-grid label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
		color: var(--muted-text, #555);
	}
	.form-grid .span2 {
		grid-column: span 2;
	}
	input,
	textarea {
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line-color, #d1d5db);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		background: var(--card-bg, #fff);
		color: var(--deep-text, inherit);
	}
	.checks {
		display: flex;
		gap: 1.5rem;
		margin-bottom: 1rem;
		font-size: 0.9rem;
		color: var(--deep-text, inherit);
	}
</style>
