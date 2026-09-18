import { writeFileSync } from "node:fs";
import { flattenSettingsDefaults } from "../../server/settings/flatten";

const out = flattenSettingsDefaults();
const target = process.argv[2] || "/tmp/flatten-snap.json";
writeFileSync(target, JSON.stringify(out, null, 1));
console.log(
	"groups:",
	Object.keys(out).length,
	"bytes:",
	JSON.stringify(out).length,
);
