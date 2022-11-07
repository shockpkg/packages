import {packages, prefixes} from '../util/packages.mjs';

export const asyncTimeout = 60000;

export const entries = [];
export const entriesRoot = [];
export const entriesChild = [];
export const entriesParents = new Map();
export const packagePrefixes = prefixes;

const itter = [...packages];
while (itter.length) {
	const entry = itter.shift();
	if (entry.packages) {
		for (const pkg of entry.packages) {
			entriesParents.set(pkg, entry);
			itter.unshift(pkg);
		}
	}
	(entriesParents.has(entry) ? entriesChild : entriesRoot).push(entry);
	entries.push(entry);
}
