export type BooknavItem = {
	title: string;        
	url: string;        
	desc?: string;        

	icon?: string;
	weight?: number;                       
	enabled?: boolean;                
};

export type BooknavGroup = {
	id: string;                          
	name: string;        
	icon?: string;                       
	desc?: string;        
	weight?: number;                       
	enabled?: boolean;                
	items: BooknavItem[];            
};

export type BooknavFaviconConfig = {
	enabled: boolean;                             

	api: string;
};

export type BooknavPageConfig = {
	title?: string;                        
	description?: string;                        
	favicon: BooknavFaviconConfig;                  
};
