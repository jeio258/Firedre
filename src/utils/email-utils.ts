

// 加密邮箱（去掉 "mailto:" 前缀后 base64 编码，SSR 侧使用）
export function encodeMailto(url: string): string {
	return Buffer.from(url.replace("mailto:", "")).toString("base64");
}

// 邮箱链接的点击解密脚本（内联 onclick 使用，浏览器侧 atob 解码）
export const MAILTO_ONCLICK_SCRIPT =
	"(function(){var e=this.getAttribute('data-encoded-email');this.href='mailto:'+atob(e);this.removeAttribute('data-encoded-email');this.removeAttribute('onclick');this.click();return false;}).call(this);";
