'use strict';

const packages = require('../util/packages');

const asyncTimeout = 60000;

const entries = [];
const entriesRoot = [];
const entriesChild = [];
const entriesParents = new Map();

const itter = [...packages.packages];
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

exports.asyncTimeout = asyncTimeout;
exports.entries = entries;
exports.entriesRoot = entriesRoot;
exports.entriesChild = entriesChild;
exports.entriesParents = entriesParents;
