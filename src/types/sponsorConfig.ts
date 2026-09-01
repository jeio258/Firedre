// 打赏方式类型
export type SponsorMethod = {
	name: string;                                
	icon?: string;                                          
	qrCode?: string;                             
	link?: string;                            
	description?: string;        
	enabled: boolean;        
};

// 打赏者列表项
export type SponsorItem = {
	name: string;                                     
	avatar?: string;                                       
	amount?: string;            
	date?: string;                   
};

// 打赏配置
export type SponsorConfig = {
	title?: string;                  
	description?: string;          
	usage?: string;          
	methods: SponsorMethod[];          
	sponsors?: SponsorItem[];             
	showSponsorsList?: boolean;                     
	showComment?: boolean;                    
	showButtonInPost?: boolean;                            
};
