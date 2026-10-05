<script lang="ts">
// DisplaySettingsIntegrated 的 effects 标签页（组件拆分，UI/功能与拆分前完全一致）。
// 纯展示：状态/函数/片段由父组件传入；sakuraEnabled 因重置处理器需要赋值，经 bind: 双向同步。
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import type { Snippet } from "svelte";

let {
	isSakuraSwitchable,
	sakuraEnabled,
	defaultSakuraEnabled,
	toggleSakuraEnabled,
	setSakuraEnabled,
	resetButton,
	toggleRow,
}: {
	isSakuraSwitchable: boolean;
	sakuraEnabled: boolean;
	defaultSakuraEnabled: boolean;
	toggleSakuraEnabled: () => void;
	setSakuraEnabled: (v: boolean) => void;
	resetButton: Snippet<[isDefault: boolean, onReset: () => void]>;
	toggleRow: Snippet<
		[icon: string, label: string, enabled: boolean, onToggle: () => void]
	>;
} = $props();
</script>

{#if isSakuraSwitchable}
<div class="">
	<div class="section-title">
		{i18n(I18nKey.effectsSettings)}
		{@render resetButton(sakuraEnabled === defaultSakuraEnabled, () => { sakuraEnabled = defaultSakuraEnabled; setSakuraEnabled(defaultSakuraEnabled); })}
	</div>
	{@render toggleRow("mdi:flower-poppy", i18n(I18nKey.sakuraEffect), sakuraEnabled, toggleSakuraEnabled)}
</div>
{/if}
