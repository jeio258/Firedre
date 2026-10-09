import type { SakuraConfig } from "@/types/effectsConfig";

export interface SakuraDims {
	width: number;
	height: number;
}

export interface SakuraRandomFn {
	(option: "x" | "y" | "s" | "r" | "a", cfg: SakuraConfig): number;
	(option: "fnx" | "fny", cfg: SakuraConfig): (x: number, y: number) => number;
	(option: "fnr", cfg: SakuraConfig): (r: number) => number;
	(option: "fna", cfg: SakuraConfig): (a: number) => number;
}

/**
 * 樱花随机取值工厂（主线程 SakuraEffect 与 sakura.worker 共用同一套逻辑，
 * 原先两处各写一遍相同的 switch）。尺寸来源由调用方以 getDims 注入 —— 两个执行环境
 * 各自维护自己的 windowWidth/Height。
 */
export function createSakuraRandom(getDims: () => SakuraDims): SakuraRandomFn {
	const fn = (option: string, cfg: SakuraConfig): unknown => {
		const dims = getDims();
		switch (option) {
			case "x":
				return Math.random() * dims.width;
			case "y":
				return Math.random() * dims.height;
			case "s":
				return cfg.size.min + Math.random() * (cfg.size.max - cfg.size.min);
			case "r":
				return Math.random() * 6;
			case "a":
				return (
					cfg.opacity.min + Math.random() * (cfg.opacity.max - cfg.opacity.min)
				);
			case "fnx": {
				const random =
					cfg.speed.horizontal.min +
					Math.random() * (cfg.speed.horizontal.max - cfg.speed.horizontal.min);
				return (x: number, _y: number) => x + random;
			}
			case "fny": {
				const random =
					cfg.speed.vertical.min +
					Math.random() * (cfg.speed.vertical.max - cfg.speed.vertical.min);
				return (_x: number, y: number) => y + random;
			}
			case "fnr":
				return (r: number) => r + cfg.speed.rotation;
			case "fna":
				return (alpha: number) => alpha - cfg.speed.fadeSpeed * 0.01;
			default:
				return undefined;
		}
	};
	return fn as SakuraRandomFn;
}
