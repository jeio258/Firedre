import { h } from "hastscript";
import { visit } from "unist-util-visit";

export default function rehypeEmailProtection(options = {}) {
	const { method = "base64" } = options;

	const base64Encode = (str) => {
		return btoa(str);
	};

	const rot13Encode = (str) => {
		return str.replace(/[a-zA-Z]/g, (char) => {
			const start = char <= "Z" ? 65 : 97;
			return String.fromCharCode(
				((char.charCodeAt(0) - start + 13) % 26) + start,
			);
		});
	};

	const encode = (str) => {
		return method === "rot13" ? rot13Encode(str) : base64Encode(str);
	};

	const generateDecodeScript = () => {
		if (method === "rot13") {
			return `
        function decodeRot13(str) {
          return str.replace(/[a-zA-Z]/g, function(char) {
            const start = char <= 'Z' ? 65 : 97;
            return String.fromCharCode(((char.charCodeAt(0) - start + 13) % 26) + start);
          });
        }
        const decodedEmail = decodeRot13(encodedEmail);
      `;
		}
		return `
      const decodedEmail = atob(encodedEmail);
    `;
	};

	return (tree) => {
		let hasEmailLinks = false;

		visit(tree, "element", (node, index, parent) => {
			if (node.tagName !== "a") {
				return;
			}

			const href = node.properties?.href;
			if (!href?.startsWith("mailto:")) {
				return;
			}

			hasEmailLinks = true;

			const email = href.replace("mailto:", "");
			const encodedEmail = encode(email);

			// 创建加密的链接元素（移除原始的 href 属性，避免重复定义）
			const otherProperties = { ...node.properties };
			delete otherProperties.href;
			const protectedLink = h(
				"a",
				{
					...otherProperties,
					href: "#",
					"data-encoded-email": encodedEmail,
					onclick: `
          (function() {
            const encodedEmail = this.getAttribute('data-encoded-email');
            ${generateDecodeScript()}
            this.href = 'mailto:' + decodedEmail;
            this.removeAttribute('data-encoded-email');
            this.removeAttribute('onclick');
            this.click();
            return false;
          }).call(this);
        `
						.replace(/\s+/g, " ")
						.trim(),
				},
				node.children,
			);

			if (parent && typeof index === "number") {
				parent.children[index] = protectedLink;
			}
		});

		if (hasEmailLinks) {
			visit(tree, "element", (node) => {
				if (node.tagName === "head") {
					const style = h(
						"style",
						`
            a[data-encoded-email] {
              cursor: pointer;
              text-decoration: underline;
              color: inherit;
            }
            a[data-encoded-email]:hover {
              text-decoration: underline;
            }
          `.trim(),
					);
					node.children.push(style);
				}
			});
		}
	};
}
