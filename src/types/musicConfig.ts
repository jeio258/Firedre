/** 字段含义详见 src/config/musicConfig.ts */
export type MusicPlayerConfig = {
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
			name: string; // 歌曲名称
			artist: string; // 艺术家
			url: string; // 音乐文件路径（相对于 public 目录）
			cover?: string; // 封面图片路径（相对于 public 目录）
			lrc?: string; // 歌词内容，支持 LRC 格式
		}>;
	};
};
