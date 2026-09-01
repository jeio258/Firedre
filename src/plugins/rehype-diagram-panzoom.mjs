import { h } from "hastscript";
import { visit } from "unist-util-visit";
import clientScript from "./diagram-panzoom-script.js?raw";
import { DIAGRAM_CONTAINER } from "./utils/diagramConstants.js";

const injectedTrees = new WeakSet();

function hasDiagramContainer(tree) {
	let found = false;
	visit(tree, "element", (node) => {
		if (found) return;
		const value = node.properties?.className ?? node.properties?.class;
		const classList = Array.isArray(value)
			? value
			: typeof value === "string"
				? value.split(/\s+/)
				: [];
		if (classList.includes(DIAGRAM_CONTAINER)) {
			found = true;
		}
	});
	return found;
}

export function rehypeDiagramPanZoom() {
	return (tree) => {
		if (injectedTrees.has(tree)) return;
		injectedTrees.add(tree);

		if (!hasDiagramContainer(tree)) return;

		const script = h("script", { type: "text/javascript" }, clientScript);
		tree.children = [...(tree.children || []), script];
	};
}
