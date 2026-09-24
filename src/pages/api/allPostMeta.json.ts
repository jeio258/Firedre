import type { APIRoute } from "astro";
import { cfEnv, methodNotAllowed, serverError } from "../../lib/api";

export const prerender = false;

export const GET: APIRoute = async () => {
	try {
		const { results } = await cfEnv.DB.prepare(`
			SELECT slug, title, description, date, categories, password
			FROM posts
			WHERE published = 1
			ORDER BY date DESC
		`).all();

		const data = (results || []).map((row: Record<string, unknown>) => ({
			id: row.slug as string,
			title: row.title as string,
			description: (row.description as string) || "",
			published: new Date(row.date as string).getTime(),
			category: (() => {
				try {
					const cats = JSON.parse((row.categories as string) || "[]");
					return Array.isArray(cats) && cats.length ? String(cats[0]) : "";
				} catch {
					return "";
				}
			})(),
			password: Boolean(row.password),
		}));

		return new Response(JSON.stringify(data), {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store",
			},
		});
	} catch (error) {
		return serverError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed(["GET"]);
