import type { ProfileConfig, SiteConfig } from "@/types/config";
import { getSearchUrl, normalizeSiteUrl, url } from "./url-utils";

export function toAbsoluteUrl(
	src: string | undefined | null,
	base: URL | string,
): string | null {
	if (!src) return null;
	if (
		src.startsWith("http://") ||
		src.startsWith("https://") ||
		src.startsWith("//") ||
		src.startsWith("data:")
	) {
		return src;
	}

	if (!src.startsWith("/")) {
		console.warn(
			`[schema-utils] toAbsoluteUrl 收到 src 相对路径 "${src}"，无法解析成可访问 URL，已跳过；请改用 toAbsoluteImageUrl`,
		);
		return null;
	}
	const baseUrl = base instanceof URL ? base : new URL(normalizeSiteUrl(base));
	return new URL(url(src), baseUrl).toString();
}

export interface BreadcrumbItem {
	name: string;
	url: string;
}

export function buildBreadcrumbList(
	items: BreadcrumbItem[],
): Record<string, unknown> {
	return {
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			item: item.url,
		})),
	};
}

function filterAbsoluteLinks(links: ProfileConfig["links"]): string[] {
	return (links ?? [])
		.map((l) => l?.url)
		.filter(
			(u): u is string =>
				!!u &&
				(u.startsWith("http://") ||
					u.startsWith("https://") ||
					u.startsWith("//")),
		);
}

export interface PersonEntityOpts {
	site: URL | string;
	profileConfig: ProfileConfig;

	authorUrl: string;

	avatarUrl?: string | null;

	description?: string;
}

function resolveSiteRoot(site: URL | string): string {

	const raw = site instanceof URL ? site.href : normalizeSiteUrl(site);
	const baseUrl = new URL(raw);
	return new URL(url("/"), baseUrl).toString();
}

export function buildPersonEntity(
	opts: PersonEntityOpts,
): Record<string, unknown> {
	const siteUrl = resolveSiteRoot(opts.site);
	const sameAs = filterAbsoluteLinks(opts.profileConfig.links);
	return {
		"@type": "Person",
		"@id": `${siteUrl}#person`,
		name: opts.profileConfig.name,
		url: opts.authorUrl,
		...(opts.avatarUrl ? { image: opts.avatarUrl } : {}),
		...(opts.description ? { description: opts.description } : {}),
		...(sameAs.length ? { sameAs } : {}),
	};
}

export function buildProfilePage(
	opts: PersonEntityOpts,
): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "ProfilePage",
		mainEntity: buildPersonEntity(opts),
	};
}

export function buildPublisherEntity(opts: {
	site: URL | string;
	siteConfig: SiteConfig;
	logo?: { url: string; width?: number; height?: number } | null;
}): Record<string, unknown> {
	const siteUrl = resolveSiteRoot(opts.site);
	const logo = opts.logo ?? null;
	return {
		"@type": "Organization",
		"@id": `${siteUrl}#organization`,
		name: opts.siteConfig.title,
		url: siteUrl,
		...(logo
			? {
					logo: {
						"@type": "ImageObject",
						url: logo.url,
						contentUrl: logo.url,
						...(logo.width ? { width: logo.width } : {}),
						...(logo.height ? { height: logo.height } : {}),
					},
				}
			: {}),
	};
}

export function buildSiteGraph(opts: {
	site: URL | string;
	siteConfig: SiteConfig;
	profileConfig: ProfileConfig;
	lang: string;
	authorUrl: string;
	avatarUrl?: string | null;
	logo?: { url: string; width?: number; height?: number } | null;
}): Record<string, unknown> {
	const siteUrl = resolveSiteRoot(opts.site);
	const person = buildPersonEntity({
		site: siteUrl,
		profileConfig: opts.profileConfig,
		authorUrl: opts.authorUrl,
		avatarUrl: opts.avatarUrl,
		description: opts.profileConfig.bio,
	});
	const publisher = buildPublisherEntity({
		site: siteUrl,
		siteConfig: opts.siteConfig,
		logo: opts.logo,
	});

	const searchTarget = `${new URL(getSearchUrl(""), siteUrl).toString()}{search_term_string}`;

	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebSite",
				"@id": `${siteUrl}#website`,
				url: siteUrl,
				name: opts.siteConfig.title,
				description: opts.siteConfig.description,
				inLanguage: opts.lang,
				publisher: { "@id": `${siteUrl}#person` },
				potentialAction: {
					"@type": "SearchAction",
					target: {
						"@type": "EntryPoint",
						urlTemplate: searchTarget,
					},
					"query-input": "required name=search_term_string",
				},
			},
			person,
			publisher,
		],
	};
}

export function safeJsonLd(data: unknown): string {
	return JSON.stringify(data).replace(/[<>&]/g, (c) =>
		c === "<" ? "\\u003c" : c === ">" ? "\\u003e" : "\\u0026",
	);
}
