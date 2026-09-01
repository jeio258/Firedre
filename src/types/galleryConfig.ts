// 相册元信息（用户在配置文件中填写）
export type GalleryAlbum = {
	id: string;                                 
	name: string;        
	description?: string;        
	date?: string;      
	location?: string;        
	tags?: string[];              
	cover?: string;                                  
	password?: string;                 
	passwordHint?: string;        
};
