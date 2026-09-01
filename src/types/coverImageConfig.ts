export type CoverImageConfig = {
	enableInPost: boolean;                 
	enableInPostOverlay?: boolean;                       
	showLoading?: boolean;            
	randomCoverImage: {
		enable: boolean;             
		apis: string[];            
	};
};
