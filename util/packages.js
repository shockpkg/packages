'use strict';

const path = require('path');

const fs = require('fs');
const glob = require('glob');
const yaml = require('js-yaml');

function pathToParts(p) {
	const [group, version] = p.replace(/\.yaml$/, '').split('/');
	const parts = version.split('.').map(Number);
	parts.unshift(group);
	return parts;
}

function comparePaths(a, b) {
	a = pathToParts(a);
	b = pathToParts(b);

	const l = Math.max(a.length, b.length);
	for (let i = 0; i < l; i++) {
		const aI = i < a.length ? a[i] : -1;
		const bI = i < b.length ? b[i] : -1;
		if (aI < bI) {
			return -1;
		}
		if (aI > bI) {
			return 1;
		}
	}
	return 0;
}

function read() {
	const packagesDir = path.join(__dirname, '..', 'packages');
	const files = glob.sync('*/*.yaml', {cwd: packagesDir});
	files.sort(comparePaths);

	const r = [];
	for (const file of files) {
		const filePath = path.join(packagesDir, file);

		// eslint-disable-next-line no-sync
		const code = fs.readFileSync(filePath, 'utf8');

		const doc = yaml.safeLoad(code);
		r.push(...doc);
	}
	return r;
}

exports.packages = read();
