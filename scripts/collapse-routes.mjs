import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const routesFile = fileURLToPath(
	new URL("../dist/_routes.json", import.meta.url),
);

const COLLAPSE_PREFIXES = ["/vditor/", "/pio/", "/assets/", "/favicon/"];
const MAX_RULES = 100;

const routes = JSON.parse(readFileSync(routesFile, "utf8"));
const exclude = Array.isArray(routes.exclude) ? routes.exclude : [];

const underPrefix = (rule) =>
	COLLAPSE_PREFIXES.some(
		(p) => rule === p.slice(0, -1) || rule.startsWith(p),
	);

const wildcards = COLLAPSE_PREFIXES.map((p) => `${p}*`);
const others = exclude.filter((rule) => !underPrefix(rule));

routes.exclude = [...wildcards, ...others].slice(0, MAX_RULES);

writeFileSync(routesFile, `${JSON.stringify(routes, null, 2)}\n`, "utf8");
