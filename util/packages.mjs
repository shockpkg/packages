import {readFile, readdir} from 'node:fs/promises';
import {dirname, join as pathJoin} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
	return p.replace(/\.json$/, '').split('/');
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

export default async function read() {
	const packagesDir = pathJoin(__dirname, '..', 'packages');
	const files = (await readdir(packagesDir, {recursive: true}))
		.filter(s => /^([^.][^/]*\/)*[^.][^/]*\.json$/.test(s))
		.sort(comparePaths);

	const packages = [];
	for (const file of files) {
		const filePath = pathJoin(packagesDir, file);

		// eslint-disable-next-line no-await-in-loop
		const code = await readFile(filePath, 'utf8');
		const doc = JSON.parse(code);
		packages.push(...doc);
	}

	return packages;
}
