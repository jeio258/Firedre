import { handleAlbumWebdavHttp } from "@server/gallery/albumWebdavHttp";
import type { APIRoute } from "astro";
import { cfEnv } from "../../../lib/api";

export const prerender = false;

export const ALL: APIRoute = async ({ request }) => {
	return handleAlbumWebdavHttp(request, { env: cfEnv });
};
