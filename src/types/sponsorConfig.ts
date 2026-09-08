export type SponsorMethod = {
	name: string;                                
	icon?: string;                                          
	qrCode?: string;                             
	link?: string;                            
	description?: string;        
	enabled: boolean;        
};

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
	methods: SponsorMethod[];          
	sponsors?: SponsorItem[];             
	showSponsorsList?: boolean;                     
	showComment?: boolean;                    
	showButtonInPost?: boolean;                            
};
