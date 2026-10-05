// MusicManager 的纯辅助函数（自组件拆分，无组件状态/闭包依赖，可复用、可单测）。

export function formatTime(seconds: number): string {
	if (!seconds || Number.isNaN(seconds)) return "0:00";
	var min = Math.floor(seconds / 60);
	var sec = Math.floor(seconds % 60);
	return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}

export function parseLRC(lrc: string): Array<{ time: number; text: string }> {
	if (!lrc) return [];
	var lines = lrc.split("\n");
	var result: Array<{ time: number; text: string }> = [];
	var timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
	lines.forEach((line: string) => {
		var matches = Array.from(line.matchAll(timeReg));
		var text = "";
		if (matches.length > 0) {
			text = line.replace(timeReg, "").trim();
			if (text) {
				matches.forEach((match) => {
					var m = Number.parseInt(match[1], 10);
					var s = Number.parseInt(match[2], 10);
					var ms = Number.parseInt(match[3], 10);
					var time = m * 60 + s + ms / (match[3].length === 3 ? 1000 : 100);
					result.push({ time: time, text: text });
				});
			}
		}
	});
	return result.sort((a, b) => a.time - b.time);
}
