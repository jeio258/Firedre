export const SENSITIVE_SETTING_KEY =
	/(auth|token|secret|password|apikey|api_?key|customcode|accesskey|adsense)/i;

export function redactSensitive<T>(input: T): T {
	if (Array.isArray(input))
		return input.map((item) => redactSensitive(item)) as unknown as T;

	if (input && typeof input === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(
			input as Record<string, unknown>,
		)) {
			out[key] = SENSITIVE_SETTING_KEY.test(key) ? "" : redactSensitive(value);
		}
		return out as T;
	}

	return input;
}
