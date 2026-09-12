export type SponsorItem = {
	name: string;                                     
	avatar?: string;                                       
	amount?: string;            
	date?: string;                   
};

export type SponsorConfig = {
	title?: string;                  
	description?: string;          
	usage?: string;          
	sponsors?: SponsorItem[];             
	showSponsorsList?: boolean;                     
	showComment?: boolean;                    
	showButtonInPost?: boolean;                            
};
