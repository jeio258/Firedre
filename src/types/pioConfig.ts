// Spine 看板娘配置
export type SpineModelConfig = {
	enable: boolean; // 是否启用 Spine 看板娘
	model: {
		path: string;                  
		scale?: number;                
		x?: number;            
		y?: number;            
	};
	position: {
		corner: "bottom-left" | "bottom-right" | "top-left" | "top-right";        
		offsetX?: number;                
		offsetY?: number;                
	};
	size: {
		width?: number;                
		height?: number;                
	};
	interactive?: {
		enabled?: boolean;                   
		clickAnimations?: string[];                
		clickMessages?: string[];                
		messageDisplayTime?: number;                     
		idleAnimations?: string[];          
		idleInterval?: number;                        
	};
	responsive?: {
		hideOnMobile?: boolean;                    
		mobileBreakpoint?: number;                 
	};
	zIndex?: number;             
	opacity?: number;                 
};

// Live2D 看板娘配置 (使用 l2d-widget)
export type Live2DWidgetConfig = {
	enable: boolean; // 是否启用 Live2D 看板娘
	model:
		| { path: string; volume?: number; scale?: number; x?: number; y?: number }
		| {
				path: string;
				volume?: number;
				scale?: number;
				x?: number;                     
				y?: number;                     
		  }[];                  
	position?: "bottom-left" | "bottom-right";                         
	size?: number | { width: number; height: number };                   
	primaryColor?: string;                       
	transitionDuration?: number;                         
	transitionType?: "slide" | "fade";                        
	menus?: {
		items?: { icon?: string; label: string; action: string }[];             
		extraItems?: { icon?: string; label: string; action: string }[];             
		align?: "left" | "right";                     
	};
	tips?: {
		enable?: boolean;                
		welcomeMessage?: string[];       
		messages?: string[];          
		duration?: number;                        
		interval?: number;                      
		offset?: { x?: number; y?: number };             
		typing?: {
			param?: string;         
			speed?: number;                     
			minValue?: number;                       
			maxValue?: number;                     
		};
	};
	responsive?: {
		hideOnMobile?: boolean;            
		mobileBreakpoint?: number;                
	};
};
