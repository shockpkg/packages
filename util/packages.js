'use strict';

const {join: pathJoin} = require('path');
const {readFileSync} = require('fs');

const glob = require('glob');
const yaml = require('js-yaml');

function comparePrimitive(a, b) {
	if (a === null && b !== null) {
		return -1;
	}
	if (b === null && a !== null) {
		return 1;
	}
	if (a < b) {
		return -1;
	}
	if (a > b) {
		return 1;
	}
	return 0;
}

function compareVersions(a, b) {
	const aCmps = a.map(parseVersionPiece);
	const bCmps = b.map(parseVersionPiece);
	for (let i = 0; i < 3; i++) {
		const aCmp = aCmps[i];
		const bCmp = bCmps[i];
		const l = Math.max(aCmp.length, bCmp.length);
		for (let j = 0; j < l; j++) {
			const aV = j < aCmp.length ? aCmp[j] : null;
			const bV = j < bCmp.length ? bCmp[j] : null;

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

function parseVersionPiece(s) {
	if (!/^[\d.]+$/.test(s)) {
		return [s];
	}
	return s.split('.').map(Number);
}

function parseVersion(s) {
	const m = s.match(/^(([^.]*)-)?([\d.]+)(-(.*))?$/);
	if (!m) {
		return null;
	}
	const [, , pre, ver, , suf] = m;
	return [pre || null, ver, suf || null];
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
	const packagesDir = pathJoin(__dirname, '..', 'packages');
	const files = glob.sync('*/*.yaml', {cwd: packagesDir});
	files.sort(comparePaths);

	const prefixes = new Set();
	const packages = [];
	for (const file of files) {
		const filePath = pathJoin(packagesDir, file);
		prefixes.add(file.split(/[\\/]/)[0]);

		// eslint-disable-next-line no-sync
		const code = readFileSync(filePath, 'utf8');

		const doc = yaml.load(code);
		packages.push(...doc);
	}

	const flat = [];
	const queue = packages.slice();
	while (queue.length) {
		const pkg = queue.shift();
		flat.push(pkg);
		if (pkg.packages) {
			queue.push(pkg.packages);
			flat.push(...pkg.packages);
		}
	}
	return {
		packages,
		prefixes,
		flat
	};
}

const data = read();
exports.packages = data.packages;
exports.prefixes = data.prefixes;
exports.flat = data.flat;
