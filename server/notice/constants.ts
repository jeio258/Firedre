import { join } from "node:path";

export const NOTICE_ROW_ID = 1;

export function noticeLocalPath(projectRoot: string) {
	return join(projectRoot, "content", "notice.json");
}
