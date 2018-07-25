'use strict';

const fs = require('fs');

const jsYaml = require('js-yaml');

const asyncTimeout = 60000;

// eslint-disable-next-line no-sync
const yaml = fs.readFileSync('./packages.yaml', 'utf8');
const doc = jsYaml.safeLoad(yaml);

const entries = [];
const entriesRoot = [];
const entriesChild = [];
const entriesParents = new Map();

const itter = [...doc];
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
exports.yaml = yaml;
exports.doc = doc;
exports.entries = entries;
exports.entriesRoot = entriesRoot;
exports.entriesChild = entriesChild;
exports.entriesParents = entriesParents;
