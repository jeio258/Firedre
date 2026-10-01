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

		const data = (results || []).map((row: unknown) => {
			const r = row as Record<string, unknown>;
			return {
				id: r.slug as string,
				title: r.title as string,
				description: (r.description as string) || "",
				published: new Date(r.date as string).getTime(),
				category: (() => {
					try {
						const cats = JSON.parse((r.categories as string) || "[]");
						return Array.isArray(cats) && cats.length ? String(cats[0]) : "";
					} catch {
						return "";
					}
				})(),
				password: Boolean(r.password),
			};
		});

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
