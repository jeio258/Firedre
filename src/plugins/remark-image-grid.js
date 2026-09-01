import { visit } from "unist-util-visit";

const BLOCK_CONTAINER_TYPES = new Set([
	"root",
	"blockquote",
	"containerDirective",
	"list",
	"listItem",
]);

function getGridColumnClass(imgCount) {
	const cols = imgCount || 2;
	if (cols === 1) return "md:grid-cols-1";
	if (cols === 2) return "md:grid-cols-2";
	if (cols === 3) return "md:grid-cols-3";
	return "md:grid-cols-4";
}

function countImages(nodes) {
	let imgCount = 0;
	nodes.forEach((node) => {
		visit(node, "image", () => {
			imgCount++;
		});
	});
	return imgCount;
}

function buildGridNode(nodes) {
	return {
		type: "paragraph",
		data: {
			hName: "div",
			hProperties: {
				className: [
					"image-grid",
					"grid",
					"grid-cols-1",
					getGridColumnClass(countImages(nodes)),
					"gap-4",
					"my-4",
				],
			},
		},
		children: nodes,
	};
}

function processGridBlocks(children) {
	const newChildren = [];
	let inGrid = false;
	let gridChildren = [];

	for (let i = 0; i < children.length; i++) {
		const node = children[i];

		if (node.type === "paragraph" && node.children.length > 0) {
			const first = node.children[0];
			const last = node.children[node.children.length - 1];

			let containsGridStart = false;
			let containsGridEnd = false;

			if (first.type === "text" && first.value.trim().startsWith("[grid]")) {
				containsGridStart = true;
			}
			if (last.type === "text" && last.value.trim().endsWith("[/grid]")) {
				containsGridEnd = true;
			}

			if (containsGridStart && containsGridEnd && !inGrid) {
				first.value = first.value.replace(/^\s*\[grid\]\s*/, "");
				last.value = last.value.replace(/\s*\[\/grid\]\s*$/, "");

				// count images in the grid
				const imgCount = node.children.filter(
					(n) =>
						n.type === "image" ||
						(n.type === "link" &&
							n.children &&
							n.children.some((c) => c.type === "image")),
				).length;
				const cols = imgCount || 2;
				const mdColClass = getGridColumnClass(cols);

				newChildren.push({
					type: "paragraph",
					data: {
						hName: "div",
						hProperties: {
							className: [
								"image-grid",
								"grid",
								"grid-cols-1",
								mdColClass,
								"gap-4",
								"my-4",
							],
						},
					},
					children: node.children.filter(
						(n) => n.type !== "text" || n.value.trim() !== "",
					), // Remove empty text nodes left over
				});
				continue;
			}

			// Case 2: Multi-paragraph
			if (!inGrid && containsGridStart) {
				inGrid = true;
				first.value = first.value.replace(/^\s*\[grid\]\s*/, "");
				if (node.children.length === 1 && first.value.trim() === "") {
					// [grid] stood alone, ignore this node
				} else {
					gridChildren.push(node);
				}
				continue;
			}

			if (inGrid && containsGridEnd) {
				inGrid = false;
				last.value = last.value.replace(/\s*\[\/grid\]\s*$/, "");
				if (node.children.length === 1 && last.value.trim() === "") {
					// [/grid] stood alone
				} else {
					gridChildren.push(node);
				}

				newChildren.push(buildGridNode(gridChildren));
				gridChildren = [];
				continue;
			}
		}

		if (inGrid) {
			gridChildren.push(node);
		} else {
			newChildren.push(node);
		}
	}

	// If unclosed, just append them
	if (inGrid) {
		newChildren.push(...gridChildren);
	}

	return newChildren;
}

export function remarkImageGrid() {
	return (tree) => {

		const processContainer = (node) => {
			if (Array.isArray(node.children)) {
				for (const child of node.children) {
					processContainer(child);
				}
			}
			if (BLOCK_CONTAINER_TYPES.has(node.type)) {
				node.children = processGridBlocks(node.children);
			}
		};

		processContainer(tree);
	};
}
