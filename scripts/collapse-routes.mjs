import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const routesFile = fileURLToPath(
	new URL("../dist/_routes.json", import.meta.url),
);

const COLLAPSE_PREFIXES = ["/assets/", "/favicon/", "/katex/"];
const MAX_RULES = 100;

const routes = JSON.parse(readFileSync(routesFile, "utf8"));
const exclude = Array.isArray(routes.exclude) ? routes.exclude : [];

const underPrefix = (rule) =>
	COLLAPSE_PREFIXES.some((p) => rule === p.slice(0, -1) || rule.startsWith(p));

const wildcards = COLLAPSE_PREFIXES.map((p) => `${p}*`);
const others = exclude.filter((rule) => !underPrefix(rule));

const merged = [...wildcards, ...others];

// 超出上限必须构建失败：静默截断会丢路由规则（资源被当函数请求或反之），且无任何提示
if (merged.length > MAX_RULES) {
	console.error(
		`[collapse-routes] ✗ 折叠后规则数 ${merged.length} 超过上限 ${MAX_RULES}，拒绝静默截断。超出项：`,
	);
	for (const rule of merged.slice(MAX_RULES)) console.error(`      ${rule}`);
	process.exit(1);
}

routes.exclude = merged;

writeFileSync(routesFile, `${JSON.stringify(routes, null, 2)}\n`, "utf8");
