export type UserSubjectCollectionResponse = {
	data: UserSubjectCollection[];
	total: number;
	limit: number;
	offset: number;
};

export type UserSubjectCollection = {
	subject_id: number;         
	subject_type: SubjectType;        
	rate: number;      
	type: CollectionType;        
	comment?: string | null;      
	tags: string[];      
	ep_status: number;        
	vol_status: number;       
	updated_at: string;                     
	private: boolean;        
	subject: SlimSubject;        
};

// 1: 想看，2: 看过，3: 在看，4: 搁置，5: 抛弃
export type CollectionType = 1 | 2 | 3 | 4 | 5;

export type SlimSubject = {
	id: number;      
	type: SubjectType;      
	name: string;      
	name_cn: string;       
	short_summary: string;      
	date?: string | null;                 
	images: SubjectImages;      
	volumes: number;      
	eps: number;      
	collection_total: number;        
	score: number;      
	rank: number;      
	tags: SubjectTag[];      
	nsfw?: boolean;                                   
};

// 1: 书籍，2: 动画，3: 音乐，4: 游戏，6: 三次元
export type SubjectType = 1 | 2 | 3 | 4 | 6;

export type SubjectTag = {
	name: string;
	count: number;
	total_cont: number;
};

export type SubjectImages = {
	large: string;
	common: string;
	medium: string;
	small: string;
	grid: string;
};
