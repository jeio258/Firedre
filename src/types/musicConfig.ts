
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
			name: string;        
			artist: string;       
			url: string;                         
			cover?: string;                         
			lrc?: string;                  
		}>;
	};
};
