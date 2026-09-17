<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";
import { clearDraft, getDraft } from "@/lib/adminDrafts";
import { registerSaveAll } from "@/lib/adminSave";
import { settingsDefaults as defaultsJson } from "../../config/settings-defaults";
import {
	CATEGORIES,
	type Field,
	GROUPS,
	type Group,
} from "./adminSettingsSchema";
import JsonEditor from "./JsonEditor.svelte";
import RecordsEditor from "./RecordsEditor.svelte";
import Switch from "./Switch.svelte";

let data = $state<Record<string, Record<string, unknown>>>({});
let loading = $state(true);
let loadError = $state("");
let saving = $state(false);
let message = $state("");
let loaded = $state(false);

let { cat = 0 }: { cat?: number } = $props();
let activeCat = $derived(CATEGORIES[typeof cat === "number" ? cat : 0]);
let groups = $derived(GROUPS.filter((g) => g.category === activeCat));
let activeGroup = $state("");
// 当前选中的评论类型（独立响应式变量，供显隐逻辑直接引用）
let cmtTypeVal = $state("");

// 分类切换时，重置到该分类首分组
$effect(() => {
	if (!groups.some((g) => g.key === activeGroup)) {
		activeGroup = groups[0]?.key ?? "";
	}
});

async function load() {
	try {
		const all = (await apiJson("/api/settings/")) as Record<
			string,
			Record<string, unknown>
		>;
		const defaults = defaultsJson as unknown as Record<
			string,
			Record<string, unknown>
		>;
		for (const g of GROUPS) {
			const saved = all[g.key] ?? {};
			const def = defaults[g.key] ?? {};
			const merged: Record<string, unknown> = {};
			for (const f of g.fields) {
				const v = saved[f.name];
				merged[f.name] = v !== undefined ? v : def[f.name];
			}
			data[g.key] = merged;
		}
		data["nav"] = { ...(defaults["nav"] ?? {}), ...(all["nav"] ?? {}) };
		cmtTypeVal = String(data["comment"]?.["type"] ?? "");
	} catch {
		loadError = "设置加载失败，请刷新重试";
	}
	loading = false;
	loaded = true;
}

function cycleBool(key: string, field: string) {
	data[key][field] = !data[key][field];
	markDirty();
}

function markDirty() {
	if (!loaded) return;
	message = "有未保存的修改，请点击「保存全部」";
}

// 字段是否可见：带 cmt 标签的字段仅在该评论类型选中时显示
function isFieldVisible(field: Field, t: string = cmtTypeVal): boolean {
	if (field.hidden) return false;
	if (field.cmt) return field.cmt === t;
	return true;
}

// 个人资料面板：为 bio/所在地/邮箱 分配 grid-area，使简介居左、所在地与邮箱居右
function profileArea(group: Group, field: Field): string {
	if (group.key !== "profile") return "";
	if (field.name === "bio") return "ar-bio";
	if (field.name === "location") return "ar-loc";
	if (field.name === "email") return "ar-eml";
	if (field.name === "name") return "ar-name";
	if (field.name === "avatar") return "ar-avatar";
	return "";
}

const jsonFields = new Set(
	GROUPS.flatMap((g) =>
		g.fields
			.filter((f) => f.type === "json" || f.type === "records")
			.map((f) => f.name),
	),
);

async function save() {
	saving = true;
	message = "";
	try {
		const out: Record<string, Record<string, unknown>> = {};

		for (const g of GROUPS) {
			const payload = { ...(data[g.key] ?? {}) };
			for (const k of Object.keys(payload)) {
				const v = payload[k];
				if (jsonFields.has(k)) {
					if (v === "" || v == null) delete payload[k];
				} else if (v == null) {
					delete payload[k];
				}
			}
			out[g.key] = payload;
		}
		out["nav"] = { ...(data["nav"] ?? {}) };
		try {
			await apiJson("/api/settings/", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ groups: out }),
			});
		} catch (err) {
			if (err instanceof TypeError) throw err;
			message = `保存失败：${err instanceof Error ? err.message : ""}`;
			return;
		}
		message = `已保存 ✓ ${new Date().toLocaleTimeString()}`;
		clearDraft("站点设置");

		applyHueToAdmin(data["basic"]?.hue);
	} catch {
		message = "网络错误，修改尚未保存";
	} finally {
		saving = false;
	}
}

function applyHueToAdmin(hue: unknown) {
	if (typeof document === "undefined") return;

	if (hue == null || hue === "") return;
	const h = Number(hue);
	if (!Number.isFinite(h) || h < 0 || h > 360) return;
	document.documentElement.style.setProperty("--hue", String(h));
	document.body.style.background = getComputedStyle(document.documentElement)
		.getPropertyValue("--page-bg")
		.trim();
}

// 暴露给顶栏「保存全部」
onMount(async () => {
	await load();
	const d = getDraft<Record<string, Record<string, unknown>>>("站点设置");
	if (d) {
		data = d;
		clearDraft("站点设置");
	}
	return registerSaveAll("站点设置", save, () => data);
});
</script>

<div class="crud-page">
	<div class="settings-head">
		<div class="settings-t">
			<h2 class="settings-title">站点设置</h2>
			<span class="settings-count">{activeCat} · {groups.length} 个分组</span>
		</div>
		<p class="settings-note">
			在左侧「系统 → 站点设置」下选择配置大类，再点击上方分组标签进行编辑；修改后点右上角「保存全部」统一生效。
		</p>
		<div class="settings-nav">
			{#each groups as g (g.key)}
				<button class="sn" class:on={activeGroup === g.key} onclick={() => (activeGroup = g.key)}>{g.title}</button>
			{/each}
		</div>
	</div>

	{#if message}
		<div class="save-msg" class:err={/失败|错误/.test(message)} role="status">{message}</div>
	{/if}

	{#if loading}
		<div class="crud-empty">加载中…</div>
	{:else if loadError}
		<div class="crud-empty danger">{loadError}</div>
	{:else}
		<!-- 当前分类下，按选中的分组标签展示单张卡片 -->
		<div class="s2-host">
			<section class="s2pane on">
				{#each groups.filter((g) => g.key === activeGroup) as group (group.key)}
					<section class="a2card" class:profile={group.key === "profile"}>
						<header>
							<h4>{group.title}</h4>
							<span class="cnt">{group.fields.filter((f) => isFieldVisible(f, cmtTypeVal)).length} 项</span>
						</header>
						{#if group.fields.some((f) => isFieldVisible(f, cmtTypeVal) && f.type === "boolean")}
							<div class="a2sws">
								{#each group.fields.filter((f) => isFieldVisible(f, cmtTypeVal) && f.type === "boolean") as field (field.name)}
									<label class="a2tr">
										<span class="a2tx">{field.label}</span>
										<Switch
											on={data[group.key]?.[field.name] === true}
											label={field.label}
											toggle={() => cycleBool(group.key, field.name)}
										/>
									</label>
								{/each}
							</div>
						{/if}
						{#if group.fields.some((f) => isFieldVisible(f, cmtTypeVal) && f.type !== "boolean")}
							<div class="a2fg">
								{#each group.fields.filter((f) => isFieldVisible(f, cmtTypeVal) && f.type !== "boolean") as field (field.name)}
									<div class="a2f {field.wide ? 'w' : ''} {profileArea(group, field)}">
										<label>{field.label}{#if field.hint}<small>{field.hint}</small>{/if}</label>
										{#if field.type === "select"}
											<select onchange={(e) => { const v = e.currentTarget.value; data[group.key][field.name] = v; cmtTypeVal = v; markDirty(); }}>
												{#each field.options ?? [] as opt}
													<option value={opt.value} selected={((data[group.key]?.[field.name] as string) ?? "") === opt.value}>{opt.label}</option>
												{/each}
											</select>
										{:else if field.type === "textarea"}
											<textarea rows="3" value={(data[group.key]?.[field.name] as string) ?? ""} placeholder={field.placeholder} oninput={(e) => { data[group.key][field.name] = e.currentTarget.value; markDirty(); }}></textarea>
										{:else if field.type === "json"}
											<JsonEditor
												value={data[group.key]?.[field.name]}
												placeholder={field.placeholder ?? ""}
												fieldLabel={field.label}
												onChange={(v) => { data[group.key][field.name] = v; markDirty(); }}
											/>
										{:else if field.type === "records"}
											<RecordsEditor
												value={data[group.key]?.[field.name]}
												recordFields={field.recordFields ?? []}
												objectFields={field.objectFields ?? []}
												separator={field.separator ?? "|"}
												fieldLabel={field.label}
												placeholder={field.placeholder ?? ""}
												onChange={(v) => { data[group.key][field.name] = v; markDirty(); }}
											/>
										{:else if field.type === "password"}
											<input type="password" value={(data[group.key]?.[field.name] as string) ?? ""} placeholder={field.placeholder} autocomplete="off" oninput={(e) => { data[group.key][field.name] = e.currentTarget.value; markDirty(); }} />
										{:else if field.type === "number"}
											<input type="number" value={(data[group.key]?.[field.name] as number) ?? ""} oninput={(e) => { data[group.key][field.name] = e.currentTarget.valueAsNumber; markDirty(); }} />
										{:else}
											<input type="text" value={(data[group.key]?.[field.name] as string) ?? ""} placeholder={field.placeholder} oninput={(e) => { data[group.key][field.name] = e.currentTarget.value; markDirty(); }} />
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{/each}
			</section>
		</div>
	{/if}
</div>


<style>
	.crud-empty.danger {
		color: var(--danger);
		border-color: color-mix(in oklch, var(--danger) 40%, var(--line-divider));
	}

	.save-msg {
		margin: 0 0 0.8rem;
		padding: 0.55rem 0.9rem;
		border-radius: var(--radius-medium);
		font-size: 0.85rem;
		font-weight: 600;
		background: color-mix(in oklch, var(--primary) 12%, transparent);
		color: var(--primary);
		border: 1px solid color-mix(in oklch, var(--primary) 30%, transparent);
	}
	.save-msg.err {
		background: color-mix(in oklch, var(--danger) 12%, transparent);
		color: var(--danger);
		border-color: color-mix(in oklch, var(--danger) 30%, transparent);
	}
</style>
