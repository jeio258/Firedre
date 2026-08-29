export interface HtmlFileSummary {
	slug: string;
	title: string;
	description: string;
	publicPath: string;
	updatedAt: string;
	createdAt: string;
}

export interface HtmlFileDetail extends HtmlFileSummary {
	content: string;
}

export interface HtmlFileUpsertPayload {
	slug: string;
	title: string;
	description?: string;
	content: string;
}
