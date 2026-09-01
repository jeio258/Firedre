export type BackgroundWallpaperConfig = {
	mode: "banner" | "fullscreen" | "overlay" | "none";                                                           
	playerEnable?: boolean;                      
	src:
		| string
		| string[]
		| {
				desktop?: string | string[];
				mobile?: string | string[];
				playerUrl?: string | string[];                                 
		  };                             

	common?: {
		dimOpacity?: number;                               
		playerMode?: "order" | "random";                                          
		homeText?: {
			enable: boolean;                      
			title?: string;       
			subtitle?: string | string[];                     
			titleSize?: string;                      
			subtitleSize?: string;                      
			typewriter?: {
				enable: boolean;             
				speed: number;            
				deleteSpeed: number;            
				pauseTime: number;                  
			};

			linksEnable?: boolean;                          
			links?: {
				name: string;                                              
				url: string;        
				icon: string;                                    
				showName?: boolean;                    
			}[];
		};
		// 壁纸轮播配置，横幅壁纸和全屏壁纸共享
		carousel?: {
			enable: boolean;            
			interval?: number;               
			transitionEffect?: "fade" | "zoom" | "slide" | "kenburns";                                                              
		};
	};

	// Banner模式特有配置
	banner?: {
		position?:
			| "top"
			| "center"
			| "bottom"
			| "top left"
			| "top center"
			| "top right"
			| "center left"
			| "center center"
			| "center right"
			| "bottom left"
			| "bottom center"
			| "bottom right"
			| "left top"
			| "left center"
			| "left bottom"
			| "right top"
			| "right center"
			| "right bottom"
			| string;                                            

		postInfo?: {
			mode: "description" | "meta";
		};
		navbar?: {
			transparentMode?: "semi" | "full" | "semifull";           
			blur?: number;                      
		};
		waves?: {
			enable:
				| boolean
				| {
						desktop: boolean;                  
						mobile: boolean;                  
				  };                                 
		};
		// 渐变过渡效果配置，当水波纹关闭时自动启用，提供壁纸底部到背景色的平滑过渡
		gradient?: {
			enable:
				| boolean
				| {
						desktop: boolean;               
						mobile: boolean;               
				  };                                                 
			height?: string;                  
		};
	};
	// 全屏透明覆盖模式特有配置
	overlay?: {
		zIndex?: number;                   
		opacity?: number;               
		blur?: number;               
		cardOpacity?: number;                 
	};
	// 全屏壁纸模式特有配置
	fullscreen?: {
		position?: string;                                  

		navbar?: {
			dynamicTransparent?: boolean; // 是否开启动态透明：开启后首页顶部导航栏透明，下滑后变不透明
		};

		blurRamp?: {
			enable:
				| boolean
				| {
						desktop: boolean;               
						mobile: boolean;               
				  };                                      
		};
	};
};
