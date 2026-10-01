// A5：plantuml 初始值（原静态配置原值；运行时经 middleware setPlantumlRuntimeConfig 覆盖）
const staticPlantumlConfig: PlantUMLConfig = {
	enable: true,
	server: "https://www.plantuml.com/plantuml",
	lightTheme: "",
	darkTheme: "cyborg",
};

import type { PlantUMLConfig } from "@/types/plantumlConfig";

let currentPlantumlConfig: PlantUMLConfig = staticPlantumlConfig;

export function setPlantumlRuntimeConfig(config: PlantUMLConfig): void {
	currentPlantumlConfig = config;
}

export function getPlantumlRuntimeConfig(): PlantUMLConfig {
	return currentPlantumlConfig;
}
