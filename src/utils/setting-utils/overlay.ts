import { getWallpaperConfigFromWindow } from "@shared/config/runtime";
import { backgroundWallpaper } from "../../config";
import { clampNumber, createStoredNumber } from "./shared";

export function getDefaultOverlayOpacity(): number {
	return (
		getWallpaperConfigFromWindow().overlay?.opacity ??
		backgroundWallpaper.overlay?.opacity ??
		0.8
	);
}

export function getDefaultOverlayBlur(): number {
	return (
		getWallpaperConfigFromWindow().overlay?.blur ??
		backgroundWallpaper.overlay?.blur ??
		0
	);
}

export function getDefaultOverlayCardOpacity(): number {
	return (
		getWallpaperConfigFromWindow().overlay?.cardOpacity ??
		backgroundWallpaper.overlay?.cardOpacity ??
		0.6
	);
}

function applyOverlayCssVar(
	target: string,
	cssVar: string,
	min: number,
	max: number,
	unit = "",
): (value: number) => void {
	return (value: number): void => {
		if (typeof document === "undefined") return;
		const safe = clampNumber(value, min, max);
		const el =
			target === "html"
				? document.documentElement
				: document.getElementById(target);
		if (el) {
			el.style.setProperty(cssVar, unit ? `${safe}${unit}` : String(safe));
		}
	};
}

const applyOverlayOpacityToDocument = applyOverlayCssVar(
	"wallpaper-wrapper",
	"--overlay-opacity",
	0,
	1,
);
const applyOverlayBlurToDocument = applyOverlayCssVar(
	"wallpaper-wrapper",
	"--overlay-blur",
	0,
	20,
	"px",
);
const applyOverlayCardOpacityToDocument = applyOverlayCssVar(
	"html",
	"--card-transparent-opacity",
	0,
	1,
);

const overlayOpacitySetting = createStoredNumber({
	key: "overlayOpacity",
	getDefault: getDefaultOverlayOpacity,
	min: 0,
	max: 1,
	afterStore: applyOverlayOpacityToDocument,
});

export function getStoredOverlayOpacity(): number {
	return overlayOpacitySetting.getStored();
}

const overlayBlurSetting = createStoredNumber({
	key: "overlayBlur",
	getDefault: getDefaultOverlayBlur,
	min: 0,
	max: 20,
	afterStore: applyOverlayBlurToDocument,
});

export function getStoredOverlayBlur(): number {
	return overlayBlurSetting.getStored();
}

const overlayCardOpacitySetting = createStoredNumber({
	key: "overlayCardOpacity",
	getDefault: getDefaultOverlayCardOpacity,
	min: 0,
	max: 1,
	afterStore: applyOverlayCardOpacityToDocument,
});

export function getStoredOverlayCardOpacity(): number {
	return overlayCardOpacitySetting.getStored();
}

export function setOverlayOpacity(opacity: number): void {
	overlayOpacitySetting.set(opacity);
}

export function setOverlayBlur(blur: number): void {
	overlayBlurSetting.set(blur);
}

export function setOverlayCardOpacity(cardOpacity: number): void {
	overlayCardOpacitySetting.set(cardOpacity);
}

export function applyStoredOverlaySettingsToDocument(): void {
	applyOverlayOpacityToDocument(getStoredOverlayOpacity());
	applyOverlayBlurToDocument(getStoredOverlayBlur());
	applyOverlayCardOpacityToDocument(getStoredOverlayCardOpacity());
}
