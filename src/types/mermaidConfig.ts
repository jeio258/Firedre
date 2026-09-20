import type { HostThemePresetName } from "@mermanjs/web";

export type MermaidThemeName = HostThemePresetName;

export type MermaidConfig = {
	enable?: boolean;
	lightTheme: MermaidThemeName;

	darkTheme: MermaidThemeName;
};
