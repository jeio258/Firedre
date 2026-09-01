export type MalMainPicture = {
	medium?: string;
	large?: string;
};

export type MalAlternativeTitles = {
	synonyms?: string[];
	en?: string;
	ja?: string;
};

export type MalGenre = {
	id: number;
	name: string;
};

export type MalStartSeason = {
	year: number;
	season?: string; // "winter" | "spring" | "summer" | "fall"
};

export type MalNode = {
	id: number;
	title?: string;
	main_picture?: MalMainPicture | null;
	alternative_titles?: MalAlternativeTitles | null;
	mean?: number | null;                    
	media_type?: string;                                                                           
	genres?: MalGenre[];
	start_date?: string;          
	status?: string;                                                                    

	num_episodes?: number;              
	start_season?: MalStartSeason | null;

	num_chapters?: number;              
	num_volumes?: number;
};

export type MalListStatus = {
	status?: string;                                                                                                               
	score?: number;                
	updated_at?: string;
	start_date?: string;
	finish_date?: string;
	comments?: string;
	// 动画字段
	num_episodes_watched?: number;
	is_rewatching?: boolean;
	// 漫画字段
	num_chapters_read?: number;
	num_volumes_read?: number;
	is_rereading?: boolean;
};

export type MalListItem = {
	node: MalNode;
	list_status?: MalListStatus;
};

export type MalListResponse = {
	data: MalListItem[];
	paging?: {
		next?: string | null;
		previous?: string | null;
	} | null;
};
