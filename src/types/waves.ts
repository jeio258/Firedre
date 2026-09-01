
export interface WavesManagerLike {
	isRunning: boolean;

	canvas?: HTMLCanvasElement | null;
	init: () => Promise<void>;
	stop: () => void;
	getIsRunning: () => boolean;
}
