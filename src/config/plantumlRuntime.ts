import { plantumlConfig as staticPlantumlConfig } from "./plantumlConfig";
import type { PlantUMLConfig } from "../types/plantumlConfig";

let currentPlantumlConfig: PlantUMLConfig = staticPlantumlConfig;

export function setPlantumlRuntimeConfig(config: PlantUMLConfig): void {
	currentPlantumlConfig = config;
}

export function getPlantumlRuntimeConfig(): PlantUMLConfig {
	return currentPlantumlConfig;
}
