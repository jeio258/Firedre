import { h } from "hastscript";
import { visit } from "unist-util-visit";
import plantumlThemeScript from "./plantuml-theme-switch.js?raw";
import {
	DIAGRAM_CONTAINER,
	DIAGRAM_WRAPPER,
	PLANTUML_CONTAINER,
	PLANTUML_IMAGE,
	PLANTUML_WRAPPER,
} from "./utils/diagramConstants.js";
import { extractText } from "./utils/extractText.js";

function generateId() {
	const rand = Math.random().toString(36).slice(2, 8);
	return `plantuml-${rand}`;
}

const scriptInjectedTrees = new WeakSet();

export function rehypePlantuml() {
	return (tree) => {
		let foundAny = false;

		visit(tree, "element", (node) => {
			if (node.tagName !== "div" || !node.properties) {
				return;
			}
			const classProp = node.properties.className;
			const hasMarker = Array.isArray(classProp)
				? classProp.includes("plantuml-container")
				: typeof classProp === "string"
					? classProp.split(/\s+/).includes("plantuml-container")
					: false;
			if (!hasMarker) {
				return;
			}

			const lightSrc =
				node.properties["data-plantuml-light"] ||
				node.properties.dataPlantumlLight ||
				"";
			const darkSrc =
				node.properties["data-plantuml-dark"] ||
				node.properties.dataPlantumlDark ||
				lightSrc;
			let altText =
				node.properties["data-plantuml-alt"] ||
				node.properties.dataPlantumlAlt ||
				"";
			if (!altText) {
				altText = extractText(node).trim().slice(0, 200);
			}

			if (!lightSrc) {
				return;
			}

			const diagramId = generateId();

			const img = h("img", {
				class: PLANTUML_IMAGE,
				alt: altText || "PlantUML diagram",
				src: lightSrc,
				"data-light-src": lightSrc,
				"data-dark-src": darkSrc,
				loading: "lazy",
				decoding: "async",
			});

			const wrapper = h(
				"div",
				{
					class: `${DIAGRAM_WRAPPER} ${PLANTUML_WRAPPER}`,
					id: diagramId,
				},
				[img],
			);

			node.properties = {
				class: `${DIAGRAM_CONTAINER} ${PLANTUML_CONTAINER}`,
			};
			node.children = [wrapper];

			foundAny = true;
		});

		if (foundAny && !scriptInjectedTrees.has(tree)) {
			scriptInjectedTrees.add(tree);
			const script = h(
				"script",
				{ type: "text/javascript" },
				plantumlThemeScript,
			);
			tree.children = [...(tree.children || []), script];
		}
	};
}
