

// 常量(与原实现一一对应)

export const VIEWBOX = { x: 0, y: 24, w: 150, h: 28 } as const;

export const WAVE_PATH_D =
	"M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v48h-352z";

export const WAVE_PATH_X_MIN: number = -160;

export const WAVE_PATH_X_MAX: number = 192;

export const WAVE_X_MIN: number = WAVE_PATH_X_MIN + 48;        
export const WAVE_X_MAX: number = WAVE_PATH_X_MAX + 48;       

export const WAVE_STRIP_W: number = WAVE_X_MAX - WAVE_X_MIN;

export interface WavesLayer {

	y: number;

	alpha: number;

	duration: number;

	delay: number;
}

export const WAVE_LAYERS: readonly WavesLayer[] = [
	{ y: 0, alpha: 0.25, duration: 8, delay: 0 },
	{ y: 3, alpha: 0.5, duration: 9, delay: -2.25 },
	{ y: 5, alpha: 0.65, duration: 10, delay: -5 },
	{ y: 7, alpha: 0.75, duration: 11, delay: -8.25 },
];

export const TRANSLATE_FROM: number = -90;
export const TRANSLATE_TO: number = 85;

export const EASE = [0.5, 0.5, 0.45, 0.5] as const;

// cubic-bezier 缓动采样

function sampleBezierX(u: number, x1: number, x2: number): number {
	return 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
}

function sampleBezierY(u: number, y1: number, y2: number): number {
	return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
}

function sampleBezierDX(u: number, x1: number, x2: number): number {
	return (
		3 * (1 - u) * (1 - u) * x1 +
		6 * (1 - u) * u * (x2 - x1) +
		3 * u * u * (1 - x2)
	);
}

export function cubicBezier(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	t: number,
): number {
	const clamped = Math.min(1, Math.max(0, t));

	let u = clamped;
	for (let i = 0; i < 6; i++) {
		const x = sampleBezierX(u, x1, x2) - clamped;
		const dx = sampleBezierDX(u, x1, x2);
		if (Math.abs(x) < 1e-5 || Math.abs(dx) < 1e-6) break;
		u -= x / dx;
		u = Math.min(1, Math.max(0, u));
	}

	// 牛顿不收敛时二分兜底
	if (Math.abs(sampleBezierX(u, x1, x2) - clamped) > 1e-3) {
		let lo = 0;
		let hi = 1;
		for (let i = 0; i < 20; i++) {
			const mid = (lo + hi) / 2;
			if (sampleBezierX(mid, x1, x2) < clamped) {
				lo = mid;
			} else {
				hi = mid;
			}
		}
		u = (lo + hi) / 2;
	}

	return sampleBezierY(u, y1, y2);
}

export function ease(t: number): number {
	return cubicBezier(...EASE, t);
}

// 波浪路径

let wavePath: Path2D | null | undefined;
function getWavePath(): Path2D | null {
	if (wavePath === undefined) {
		try {
			wavePath = new Path2D(WAVE_PATH_D);
		} catch {
			wavePath = null;
		}
	}
	return wavePath;
}

// WavesRenderer:预渲染条带 + 逐帧 blit

function createCanvas(w: number, h: number): HTMLCanvasElement {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	return c;
}

export class WavesRenderer {
	private readonly ctx: CanvasRenderingContext2D;
	private strips: HTMLCanvasElement[] = [];
	private cssWidth: number;
	private cssHeight: number;
	private dpr: number;
	private fillColor: string;

	private sx = 1;
	private sy = 1;

	constructor(
		ctx: CanvasRenderingContext2D,
		cssWidth: number,
		cssHeight: number,
		dpr: number,
		fillColor: string,
	) {
		this.ctx = ctx;
		this.cssWidth = cssWidth;
		this.cssHeight = cssHeight;
		this.dpr = dpr;
		this.fillColor = fillColor;
		this.updateScale();
		this.buildStrips();
	}

	private updateScale(): void {
		this.sx = (this.cssWidth * this.dpr) / VIEWBOX.w;
		this.sy = (this.cssHeight * this.dpr) / VIEWBOX.h;
	}

	setSize(cssWidth: number, cssHeight: number, dpr: number): void {
		this.cssWidth = cssWidth;
		this.cssHeight = cssHeight;
		this.dpr = dpr;
		this.updateScale();
		this.buildStrips();
	}

	setFillColor(fillColor: string): void {
		this.fillColor = fillColor;
		this.buildStrips();
	}

	private buildStrips(): void {
		const w = Math.max(1, Math.ceil(WAVE_STRIP_W * this.sx));
		const h = Math.max(1, Math.ceil(this.cssHeight * this.dpr));
		const path = getWavePath();

		this.strips = WAVE_LAYERS.map((layer) => {
			const strip = createCanvas(w, h);
			const c = strip.getContext("2d");
			if (!c || !path) return strip;

			c.setTransform(
				this.sx,
				0,
				0,
				this.sy,
				-WAVE_PATH_X_MIN * this.sx,
				(layer.y - VIEWBOX.y) * this.sy,
			);
			c.fillStyle = this.fillColor;
			c.globalAlpha = layer.alpha;
			c.fill(path);
			return strip;
		});
	}

	draw(now: number, startTime: number): void {
		const w = Math.max(1, Math.ceil(this.cssWidth * this.dpr));
		const h = Math.max(1, Math.ceil(this.cssHeight * this.dpr));
		this.ctx.clearRect(0, 0, w, h);

		for (let i = 0; i < WAVE_LAYERS.length; i++) {
			const strip = this.strips[i];
			if (!strip) continue;
			const layer = WAVE_LAYERS[i];

			const t = (now - startTime) / 1000 - layer.delay;

			const phase = t / layer.duration - Math.floor(t / layer.duration);
			const offset =
				TRANSLATE_FROM + (TRANSLATE_TO - TRANSLATE_FROM) * ease(phase);
			this.ctx.drawImage(strip, (offset + WAVE_X_MIN) * this.sx, 0);
		}
	}
}
