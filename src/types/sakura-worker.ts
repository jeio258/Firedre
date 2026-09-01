import type { SakuraConfig } from "./effectsConfig";

export type SakuraWorkerInboundMessage =
	| {
			type: "init";
			config: SakuraConfig;

			canvas: OffscreenCanvas;
			width: number;
			height: number;
	  }
	| { type: "start" }
	| { type: "stop" }
	| { type: "resize"; width: number; height: number }
	| { type: "visibilitychange"; hidden: boolean };

export type SakuraWorkerOutboundMessage =
	| {
			type: "ready";
	  }
	| {
			type: "error";
			message: string;
			stack?: string;
	  }
	| {
			type: "messageError";
			message: string;
	  };

export interface SakuraManagerLike {
	config: SakuraConfig;
	isRunning: boolean;
	init: () => Promise<void>;
	stop: () => void;
	getIsRunning: () => boolean;
}
