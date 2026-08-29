import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const loadedRoots = new Set<string>();

function parseEnvFile(content: string) {
	const vars: Record<string, string> = {};
	const normalized = content.replace(/^\uFEFF/, "");

	for (const line of normalized.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const idx = trimmed.indexOf("=");
		if (idx === -1) continue;

		const key = trimmed.slice(0, idx).trim();
		let value = trimmed.slice(idx + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		vars[key] = value;
	}

	return vars;
}

function applyVars(vars: Record<string, string>) {
	for (const [key, value] of Object.entries(vars)) {
		if (process.env[key] === undefined) process.env[key] = value;
	}
}

export function loadAdminEnv(root = process.cwd()) {
	if (typeof process === "undefined" || !process.env) return;

	const resolvedRoot = resolve(root);
	if (loadedRoots.has(resolvedRoot)) return;

	loadedRoots.add(resolvedRoot);

	const mode = process.env.NODE_ENV || "development";
	const files = [
		".dev.vars",
		".env",
		".env.local",
		`.env.${mode}`,
		`.env.${mode}.local`,
	];

	for (const file of files) {
		const filePath = resolve(resolvedRoot, file);
		if (!existsSync(filePath)) continue;

		try {
			applyVars(parseEnvFile(readFileSync(filePath, "utf8")));
		} catch {
			// ignore unreadable env files
		}
	}
}

export function getAdminEnvFromProcess() {
	loadAdminEnv();
	return {
		ADMIN_USERNAME: process.env.ADMIN_USERNAME,
		ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
		ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN,
		SESSION_SECRET: process.env.SESSION_SECRET,
	};
}
