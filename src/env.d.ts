declare global {
	// Astro.locals.settings 类型底座（middleware 注入；形状见 server/settings/service.ts SettingsView）
	namespace App {
		interface Locals {
			settings?: import("@server/settings/service").SettingsView;
			settingsVersion?: string;
		}
	}

	interface ImportMetaEnv {
		readonly MEILI_MASTER_KEY: string;

		readonly PUBLIC_DISPLAY_SETTINGS?: string;
	}

	interface ITOCManager {
		init: () => void;
		render: () => void;
		attach: () => void;
		cleanup: () => void;
	}

	interface Window {
		SidebarTOC: {
			manager: ITOCManager | null;
		};
		FloatingTOC: {
			btn: HTMLElement | null;
			panel: HTMLElement | null;
			manager: ITOCManager | null;
			isPostPage: () => boolean;
		};
		toggleFloatingTOC: () => void;
		tocInternalNavigation: boolean;

		// biome-ignore lint/suspicious/noExplicitAny: External library without types
		spine: any;
		closeAnnouncement: () => void;

		// SSR 注入的客户端设置（形状由 SettingsView 描述）
		__FIREFLY_SETTINGS__?: import("@server/settings/service").SettingsView;

		semifullScrollHandler?: (() => void) | undefined;
		initSemifullScrollDetection?: () => void;
	}
}

export {};
