const ESCAPES: Record<string, string> = {
	"<": "\\u003c",
	">": "\\u003e",
	"&": "\\u0026",
	"\u2028": "\\u2028",
	"\u2029": "\\u2029",
};

export function serializeInlineJson(value: unknown): string {
	const json = JSON.stringify(value);
	return typeof json === "string"
		? json.replace(/[<>&\u2028\u2029]/g, (ch) => ESCAPES[ch])
		: "null";
}
