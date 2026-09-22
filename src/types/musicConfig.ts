export type MusicPlayerConfig = {
	autoplay?: boolean;
	mode?: "meting" | "local";
	volume?: number;
	playMode?: "list" | "one" | "random";
	showLyrics?: boolean;
	showInNavbar?: boolean;
	showInSidebar?: boolean;
	meting?: {
		api?: string;
		server?: "netease" | "tencent" | "kugou" | "xiami" | "baidu";
		type?: "song" | "playlist" | "album" | "search" | "artist";
		id?: string;
		auth?: string;
		fallbackApis?: string[];
	};
	local?: {
		playlist?: Array<{
			name: string;
			artist: string;
			/** 直接可用的音频地址；留空时按 source+id 经 /api/music/url/ 解析 */
			url?: string;
			cover?: string;
			lrc?: string;
			/** 音源平台与歌曲 ID（无 url 时必须提供）；链接有时效，播放时实时解析 */
			source?: "wy" | "tx" | "kw" | "kg" | "mg";
			id?: string;
			quality?: "128k" | "320k" | "flac";
		}>;
	};
	enable?: boolean;
	sourceScript?: string;
};
