export type AnnouncementConfig = {
	icon?: string;
	type?: "info" | "warning" | "success" | "error";
	closable?: boolean;
	link?: {
		enable?: boolean;
		text?: string;
		url?: string;
		external?: boolean;
	};
	enable?: boolean;
};
