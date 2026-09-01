export type NoticeLineInput =
	| string
	| {
			text: string;
			url?: string;
	  };

export interface NoticeLine {
	text: string;
	url?: string;
}

export interface NoticeSection {
	label: string;
	lines: NoticeLine[];
}

export interface NoticeBoard {
	title: string;
	sections: NoticeSection[];
}

export interface NoticeBoardDetail extends NoticeBoard {
	updatedAt?: string;
}
