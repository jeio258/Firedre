import { visit } from "unist-util-visit";
import { buildUrl, encodePlantUML, injectTheme } from "./plantuml-encoder.js";

const DEFAULT_OPTIONS = {
	enable: true,
	server: "https://www.plantuml.com/plantuml",
	lightTheme: "",
	darkTheme: "",
};

export function remarkPlantuml(options = {}) {
	const config = { ...DEFAULT_OPTIONS, ...options };

	return (tree) => {
		if (config.enable === false) {
			return;
		}

		visit(tree, "code", (node) => {
			const lang = typeof node.lang === "string" ? node.lang.toLowerCase() : "";
			if (lang !== "plantuml") {
				return;
			}

			const code = typeof node.value === "string" ? node.value : "";
			if (!code.trim()) {
				return;
			}

			const lightSource = injectTheme(code, config.lightTheme);
			const darkSource = injectTheme(code, config.darkTheme);

			const lightUrl = buildUrl(config.server, encodePlantUML(lightSource));
			const darkUrl =
				darkSource === lightSource
					? lightUrl
					: buildUrl(config.server, encodePlantUML(darkSource));

			node.type = "plantuml";
			node.data = {
				hName: "div",
				hProperties: {
					className: ["plantuml-container"],
					"data-plantuml-light": lightUrl,
					"data-plantuml-dark": darkUrl,
					"data-plantuml-alt": code.slice(0, 200),
				},
				hChildren: [{ type: "text", value: code }],
			};
			node.value = undefined;
		});
	};
}
