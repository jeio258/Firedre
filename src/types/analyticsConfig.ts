export type AnalyticsConfig = {
	googleAnalyticsId?: string;                       
	microsoftClarityId?: string;                        
	umamiAnalytics?: {
		websiteId?: string;                    
		scriptUrl?: string;                     
		replaysScriptUrl?: string;                  
		trackOutboundLinks?: boolean;                        
		collectWebVitals?: boolean;                              
		replays?: {
			enabled?: boolean;                     
			sampleRate?: number;                          
			maskLevel?: "moderate" | "strict";                      
			maxDuration?: number;                          
			blockSelector?: string;                       
		};
	};
	la51Analytics?: {
		Id?: string;              
		sdkUrl?: string;                                                            
		ck?: string;                             
		autoTrack?: boolean;                    
		hashMode?: boolean;                                 
		screenRecord?: boolean;                    
	};
};
