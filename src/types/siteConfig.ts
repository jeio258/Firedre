import type {
	DARK_MODE,
	LIGHT_MODE,
	SYSTEM_MODE,
	WALLPAPER_BANNER,
	WALLPAPER_FULLSCREEN,
	WALLPAPER_NONE,
	WALLPAPER_OVERLAY,
} from "../constants/constants";
import type { NsfwMode } from "./nsfw";

export type LIGHT_DARK_MODE =
	| typeof LIGHT_MODE
	| typeof DARK_MODE
	| typeof SYSTEM_MODE;

export type WALLPAPER_MODE =
	| typeof WALLPAPER_BANNER
	| typeof WALLPAPER_FULLSCREEN
	| typeof WALLPAPER_OVERLAY
	| typeof WALLPAPER_NONE;

export type Favicon = {
	src: string;
	theme?: "light" | "dark";
	sizes?: string;
};

export type SiteConfig = {
	title: string;
	subtitle: string;
	site_url: string;
	description?: string;                                       
	keywords?: string[];                                     

	lang: "en" | "zh_CN" | "zh_TW" | "ja" | "ru" | "ko";

	themeColor: {
		hue: number;
		defaultMode?: LIGHT_DARK_MODE; // 默认模式：浅色、深色或跟随系统
	};

	// 页面整体宽度（单位：rem）
	pageWidth?: number;

	// 卡片样式配置
	card: {
		// 是否开启卡片边框和阴影立体效果
		border: boolean;
		// 是否让卡片风格跟随主题色相
		followTheme?: boolean;
		// 卡片圆角大小 (rem)
		radius?: number;
	};

	siteStartDate?: string;                    

	timezone?: string;

	favicon: Array<{
		src: string;
		theme?: "light" | "dark";
		sizes?: string;
	}>;

	navbar: {

		logo?: {
			type: "icon" | "image" | "url";
			value: string;                        
			valueDark?: string;                                               
			alt?: string;           
		};
		title?: string;                        
		widthFull?: boolean;               
		menuAlign?: "left" | "center";                    
		followTheme?: boolean;                   
		stickyNavbar?: boolean;                  
	};

	// 页面开关配置
	pages: {
		booknav: boolean;            
		friends: boolean;          
		sponsor: boolean;          
		guestbook: boolean;           
		bangumi: boolean;
		vndb: boolean;
		mal: boolean;                    
		gallery: boolean;          
		bilibili: boolean;              
		dynamic: boolean;          
	};

	// 分类导航栏开关
	categoryBar?: boolean;

	categoryStyle?: "pill" | "rectangle";

	tagStyle?: "pill" | "pill-gray" | "rectangle";

	// 归档页是否折叠非最新年份文章
	foldArticle?: boolean;

	// 文章列表布局配置
	postListLayout: {
		defaultMode: "list" | "grid";                              
		mobileDefaultMode?: "list" | "grid";                                               

		coverPosition?: "left" | "right";
		descriptionLines?: number;                           
		showStatsIcons?: boolean;                  

		tagsPosition?: "meta" | "bottom";

		tagsBottomStyle?: "chip" | "text";
		// PostMeta 元数据显示控制
		meta?: {
			showPublished?: boolean;            
			showCategory?: boolean;          
			showTags?: boolean;          
			tagCount?: number;        
			showWords?: boolean;          
			showReadingTime?: boolean;            
		};
		// PostStats 统计信息显示控制
		stats?: {
			showPublished?: boolean;            
			showWords?: boolean;          
			showReadingTime?: boolean;            
		};
		grid: {

			masonry: boolean;
			// 网格模式卡片最小宽度(px)，浏览器根据容器宽度自动计算列数，默认 320
			columnWidth?: number;
			// 网格模式封面是否撑满卡片贴边，false 则按卡片内边距内缩
			coverFullWidth?: boolean;
		};
	};

	// 文章内容页配置
	post: {
		// 提醒框（Admonitions）配置
		rehypeCallouts: {
			theme: "github" | "obsidian" | "vitepress" | "docusaurus";
			enablePythonMarkdownAdmonitions?: boolean;
		};
		// 控制"上次编辑时间"卡片显示的开关
		showLastModified: boolean;
		// 文章过期阈值（天数），超过此天数才显示"上次编辑"卡片
		outdatedThreshold?: number;
		// 是否显示分享海报按钮
		sharePoster?: boolean;
		// OpenGraph图片功能
		generateOgImages: boolean;
	};

	// bangumi配置
	bangumi?: {
		userId?: string;               
		mode?: "static" | "dynamic";                                     
		apiUrl?: string;                  
		subjectBaseUrl?: string;           
		categoryOrder?: ("anime" | "game" | "book" | "music" | "real")[];            

		categories?: {
			book?: boolean;
			anime?: boolean;
			music?: boolean;
			game?: boolean;
			real?: boolean;
		};
		nsfw?: NsfwMode;                                                  
	};

	// VNDB 配置
	vndb?: {
		userId?: string;                      
		mode?: "static" | "dynamic";                                     
		downloadCovers?: boolean;                       
		apiUrl?: string;               
		vnBaseUrl?: string;                        
		apiToken?: string;                           
		nsfw?: NsfwMode;                                                  
	};

	// MyAnimeList 配置
	mal?: {
		username?: string;                            
		clientId?: string;                                                                       
		apiUrl?: string;              
		animeBaseUrl?: string;                     
		mangaBaseUrl?: string;                     
		nsfw?: NsfwMode;                                                  
	};

	// Bilibili 配置
	bilibili?: {
		uid?: string; // Bilibili 用户 UID
	};

	// 分页配置
	pagination: {
		postsPerPage: number; // 每页显示的文章数量
	};

	imageOptimization?: {

		formats?: "avif" | "webp" | "both";

		quality?: number;

		noReferrerDomains?: string[];
	};
};
