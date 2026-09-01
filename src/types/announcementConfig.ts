export type AnnouncementConfig = {

	title?: string;         
	content: string;         
	icon?: string;         
	type?: "info" | "warning" | "success" | "error";        
	closable?: boolean;         
	link?: {
		enable: boolean;          
		text: string;        
		url: string;        
		external?: boolean;          
	};
};
