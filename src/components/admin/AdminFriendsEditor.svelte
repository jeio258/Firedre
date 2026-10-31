<script lang="ts">
import AdminCrudEditor, { type CrudField } from "./AdminCrudEditor.svelte";
import AdminPageConfig from "./AdminPageConfig.svelte";

type FriendItem = {
	id: number;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags: string[];
	weight: number;
	enabled: boolean;
};

const fields: CrudField[] = [
	{
		key: "title",
		label: "名称 *",
		type: "text",
		placeholder: "友链名称",
		required: true,
	},
	{
		key: "imgurl",
		label: "头像地址 *",
		type: "text",
		placeholder: "https://example.com/avatar.png",
		required: true,
	},
	{
		key: "siteurl",
		label: "友链地址 *",
		type: "text",
		placeholder: "https://example.com",
		required: true,
	},
	{ key: "desc", label: "描述", type: "text", placeholder: "一句介绍" },
	{
		key: "tags",
		label: "标签（逗号分隔）",
		type: "text",
		placeholder: "如：Blog, 技术",
		toPayload: (v) =>
			String(v)
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean),
	},
	{ key: "weight", label: "排序权重", type: "number" },
	{ key: "enabled", label: "启用（显示在友链页）", type: "checkbox" },
];
</script>

<AdminCrudEditor
	apiPath="/api/friends/"
	title="友链管理"
	addLabel="+ 添加友链"
	entityName="友链"
		{fields}
		identify={(item) => String(item.title ?? "")}
	>
		{#snippet configBlock()}
			<AdminPageConfig
				group="friends"
				enableKey="enabled"
				enableLabel="启用友链页"
				title="友链"
				titleField="title"
				descField="description"
			/>
		{/snippet}
		{#snippet children({ item })}
		{@const i = item as { imgurl?: string; title?: string; enabled?: boolean; desc?: string; siteurl?: string; tags?: string[] }}
		<div class="f-row">
			<img src={i.imgurl} alt={i.title} class="avatar" />
			<div class="f-text">
				<div class="f-name">
					<strong>{i.title}</strong>
					{#if !i.enabled}
						<span class="ui-badge">未启用</span>
					{/if}
				</div>
				<div class="f-desc ui-sub">{i.desc || "无描述"}</div>
				<div class="f-url ui-sub">{i.siteurl}</div>
				{#if i.tags && i.tags.length > 0}
					<div class="f-tags">
						{#each i.tags as tag}
							<span class="ui-badge">{tag}</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/snippet}
</AdminCrudEditor>

<style>
	.f-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.avatar {
		width: 52px;
		height: 52px;
		object-fit: cover;
		flex-shrink: 0;
	}
	.f-text {
		min-width: 0;
	}
	.f-name {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.f-desc,
	.f-url {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 420px;
	}
	.f-tags {
		display: flex;
		gap: 6px;
		margin-top: 4px;
		flex-wrap: wrap;
	}
</style>
