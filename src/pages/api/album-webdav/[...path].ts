import type { APIRoute } from "astro";
import { handleAlbumWebdavHttp } from "../../../../server/albumWebdavHttp";
import { cfEnv } from "../../../lib/api";

export const prerender = false;

export const ALL: APIRoute = async ({ request }) => {
	return handleAlbumWebdavHttp(request, { env: cfEnv });
};
