// 追番功能 TypeScript 接口定义

// 标准化后的番剧数据结构（页面和组件统一使用此接口）
export interface StandardizedAnime {
	id: number;                           
	title: string;        
	originalTitle: string;               
	poster: string | null;                      
	type: "tv" | "movie";                 
	season_type: number;                                              
	rating: number;            
	date: string;                    
	overview: string;        
	link: string;        
	epStatus: string | undefined;        
}
