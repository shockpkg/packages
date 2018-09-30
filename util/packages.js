'use strict';

const path = require('path');

const fs = require('fs');
const glob = require('glob');
const yaml = require('js-yaml');

function comparePrimitive(a, b) {
	if (a < b) {
		return -1;
	}
	if (a > b) {
		return 1;
	}
	return 0;
}

function compareVersions(a, b) {
	for (let i = 0; i < 2; i++) {
		const l = Math.max(a[i].length, b[i].length);
		for (let j = 0; j < l; j++) {
			const aV = j < a[i].length ? a[i][j] : -1;
			const bV = j < b[i].length ? b[i][j] : -1;

			const cmp = comparePrimitive(aV, bV);
			if (cmp) {
				return cmp;
			}
		}
	}
	return 0;
}

function comparePart(a, b) {
	const aV = parseVersion(a);
	const bV = parseVersion(b);
	if (aV && bV) {
		return compareVersions(aV, bV);
	}
	return comparePrimitive(a, b);
}

function pathToParts(p) {
	return p.replace(/\.yaml$/, '').split('/');
}

function parseVersion(s) {
	if (
		!/^[\d.-]+$/.test(s) ||
		!/^\d/.test(s) ||
		!/\d$/.test(s) ||
		s.indexOf('-') !== s.lastIndexOf('-')
	) {
		return null;
	}
	const parts = s.split('-').map(e => e.split('.').map(Number));
	if (parts.length < 2) {
		parts.push([]);
	}
	return parts;
}

function comparePaths(a, b) {
	a = pathToParts(a);
	b = pathToParts(b);

	const l = Math.max(a.length, b.length);
	for (let i = 0; i < l; i++) {
		const cmp = comparePart(a[i], b[i]);
		if (cmp) {
			return cmp;
		}
	}
	return 0;
}

function read() {
	const packagesDir = path.join(__dirname, '..', 'packages');
	const files = glob.sync('*/*.yaml', {cwd: packagesDir});
	files.sort(comparePaths);

	const prefixes = new Set();
	const packages = [];
	for (const file of files) {
		const filePath = path.join(packagesDir, file);
		prefixes.add(file.split(/[\\/]/)[0]);

		// eslint-disable-next-line no-sync
		const code = fs.readFileSync(filePath, 'utf8');

		const doc = yaml.safeLoad(code);
		packages.push(...doc);
	}
	return {
		packages,
		prefixes
	};
}

const data = read();
exports.packages = data.packages;
exports.prefixes = data.prefixes;
