export * from "./types";

import { extensionGroups } from "./extensions";
import { featureGroups } from "./features";
import { pageGroups } from "./pages";
import { siteGroups } from "./site";
import type { Group } from "./types";

export const GROUPS: Group[] = [
	...siteGroups,
	...featureGroups,
	...pageGroups,
	...extensionGroups,
];
