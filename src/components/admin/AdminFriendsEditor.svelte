<script lang="ts">
	import AdminCrudEditor, { type CrudField } from "./AdminCrudEditor.svelte";

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
		{ key: "title", label: "名称 *", type: "text", placeholder: "友链名称", required: true },
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
	{#snippet children({ item })}
		<div class="friend-info">
			<img src={item.imgurl} alt={item.title} class="avatar" />
			<div class="friend-text">
				<div class="friend-name">
					{item.title}
					{#if !item.enabled}
						<span class="u-chip off">未启用</span>
					{/if}
				</div>
				<div class="friend-desc">{item.desc || "无描述"}</div>
				<div class="friend-url">{item.siteurl}</div>
				{#if item.tags && item.tags.length > 0}
					<div class="friend-tags">
						{#each item.tags as tag}
							<span class="tag">{tag}</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/snippet}
</AdminCrudEditor>

<style>
	.friend-info {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.avatar {
		width: 52px;
		height: 52px;
		border-radius: 0.75rem;
		object-fit: cover;
		flex-shrink: 0;
		background: var(--btn-regular-bg);
	}

	.u-chip.off {
		background: var(--btn-regular-bg);
		color: var(--text-muted);
	}
	.friend-text {
		min-width: 0;
	}
	.friend-name {
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.friend-desc {
		font-size: 0.85rem;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 420px;
	}
	.friend-url {
		font-size: 0.75rem;
		color: var(--primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 420px;
	}
	.friend-tags {
		display: flex;
		gap: 0.3rem;
		margin-top: 0.3rem;
		flex-wrap: wrap;
	}
	.tag {
		font-size: 0.7rem;
		padding: 0.1rem 0.5rem;
		background: var(--btn-regular-bg);
		border-radius: 0.3rem;
		color: var(--muted);
	}
</style>
