import type { MusicPlayerConfig } from "@/types/musicConfig";

export const musicPlayerConfig: MusicPlayerConfig = {
	showInNavbar: true,

	showInSidebar: true,

	mode: "local",

	// 默认音量 (0-1)
	volume: 0.7,

	playMode: "list",

	showLyrics: false,

	meting: {
		api: "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",

		server: "netease",

		type: "playlist",
		// 歌单/专辑/单曲 ID 或搜索关键词
		id: "10046455237",
		// 认证 token（可选）
		auth: "",
		// 备用 API 配置（当主 API 失败时使用）
		fallbackApis: [
			"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
			"https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
		],
	},

	local: {
		playlist: [
			{
				name: "使一颗心免于哀伤",
				artist: "知更鸟 / HOYO-MiX / Chevy",
				url: "/assets/music/使一颗心免于哀伤-哼唱.mp3",
				cover: "/assets/music/cover/109951169585655912.webp",
				lrc: "",
			},
			{
				// 示例：不填 url，按 source+id 经音源实时解析（链接有时效，每次播放重新解析）
				name: "晴天",
				artist: "周杰伦",
				source: "tx",
				id: "0039MnYb0qxYhV",
				quality: "128k",
				cover: "/assets/music/cover/109951169585655912.webp",
				lrc: "",
			},
		],
	},
};
