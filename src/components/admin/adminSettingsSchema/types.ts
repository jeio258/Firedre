export type FieldType =
	| "text"
	| "number"
	| "boolean"
	| "textarea"
	| "json"
	| "password"
	| "select"
	| "records";
export interface SelectOption {
	label: string;
	value: string;
}
/** type="records" 时单条记录的字段声明（key 为空字符串表示纯字符串列表） */
export interface RecordFieldSpec {
	key: string;
	label: string;
	required?: boolean;
	/** 允许值；填写后按枚举校验 */
	options?: string[];
	/** 行内文本与存储值的类型转换，默认 string；list 表示逗号分隔的字符串数组 */
	valueType?: "string" | "boolean" | "number" | "list";
}
export interface Field {
	name: string;
	label: string;
	type: FieldType;
	placeholder?: string;
	hint?: string;
	wide?: boolean;
	hidden?: boolean;
	options?: SelectOption[];
	// 仅当所属评论类型为指定值时显示（用于评论系统按类型动态显隐）
	cmt?: string;
	/** type="records" 且值为数组时的记录字段声明 */
	recordFields?: RecordFieldSpec[];
	/** type="records" 且值为单个对象时的字段声明（单行呈现，字段用 separator 分隔） */
	objectFields?: RecordFieldSpec[];
	/** type="records" 且值为「分组含子项」的两级结构：父级字段 */
	groupFields?: RecordFieldSpec[];
	/** type="records" 两级结构的子项字段（缩进行） */
	itemFields?: RecordFieldSpec[];
	/** 两级结构子项的缩进前缀，默认两个空格 */
	indent?: string;
	/** type="records" 时的行内分隔符，默认 "|" */
	separator?: string;
}
export interface Group {
	key: string;
	title: string;
	category: "站点配置" | "功能配置" | "页面配置" | "扩展功能";
	fields: Field[];
}

export const CATEGORIES = [
	"站点配置",
	"功能配置",
	"页面配置",
	"扩展功能",
] as const;
