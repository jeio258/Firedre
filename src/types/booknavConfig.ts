// 书签导航配置

// 单个书签条目
export type BooknavItem = {
	title: string;        
	url: string;        
	desc?: string;        

	icon?: string;
	weight?: number;                       
	enabled?: boolean;                
};

// 书签分组
export type BooknavGroup = {
	id: string;                          
	name: string;        
	icon?: string;                       
	desc?: string;        
	weight?: number;                       
	enabled?: boolean;                
	items: BooknavItem[];            
};

// favicon 自动获取配置
export type BooknavFaviconConfig = {
	enabled: boolean;                             

	api: string;
};

// 书签导航页面配置
export type BooknavPageConfig = {
	title?: string;                        
	description?: string;                        
	favicon: BooknavFaviconConfig;                  
};
