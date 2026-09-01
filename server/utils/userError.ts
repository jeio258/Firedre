/**
 * 用户可读的业务/校验错误。
 *
 * 这类错误的消息可以安全回显给前端（不含内部路径、SQL、堆栈等敏感信息）。
 * 与之相对，普通 Error（或底层库抛出的原始错误）的消息一律对外隐藏，
 * 避免在 500 响应中泄露内部实现细节。
 *
 * 用法：service 层对“可预期的校验/业务失败”用 `throw new UserError("中文提示")`，
 * API 层的 `serverError()` 仅回显 UserError 的消息，其余回显通用消息。
 */
export class UserError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UserError";
	}
}
