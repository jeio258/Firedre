
export function initTouchCodeCopyReveal(): void {
	const CLASS = "ff-copy-revealed";

	document.addEventListener("click", (event) => {

		if (window.matchMedia("(hover: hover)").matches) return;

		const target = event.target as Element | null;
		if (!target?.closest) return;

		const frame = target.closest(".expressive-code .frame");

		document.querySelectorAll(`.${CLASS}`).forEach((revealed) => {
			if (revealed !== frame) revealed.classList.remove(CLASS);
		});

		// 点在复制按钮上时说明它已经显形，交给原生逻辑处理即可
		if (frame && !target.closest(".copy")) frame.classList.add(CLASS);
	});
}
