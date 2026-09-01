// 友链配置
export type FriendLink = {
	title: string;        
	imgurl: string;           
	desc: string;        
	siteurl: string;        
	tags?: string[];        
	weight: number;                
	enabled: boolean;        
};

export type FriendsPageConfig = {
	title?: string;                        
	description?: string;                        
	showCustomContent?: boolean;                          
	showComment?: boolean;                   
	randomizeSort?: boolean;                                   
};
