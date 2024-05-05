import {readFile, readdir} from 'node:fs/promises';
import {dirname, join as pathJoin} from 'node:path';
import {fileURLToPath} from 'node:url';

import {walk} from './util.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const directory = pathJoin(__dirname, '..', 'packages');

const andReg = /^(.*)-([\d.]+)-and-([\d.]+|higher)$/;

const misplacedChildren = new Set([
	'flash-player-2-java',
	'flash-player-9.0.262.0-linux-sa'
]);

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

export async function readPackageFile(f) {
	const pre = f.replace(/\.json$/, '').replace(/[\\/]/i, '-');
	const pres = [pre];
	const m = pre.match(andReg);
	if (m) {
		pres.push(`${m[1]}-${m[2]}`);
		if (m[3] !== 'higher') {
			pres.push(`${m[1]}-${m[3]}`);
		}
	}

	const pkgs = JSON.parse(await readFile(pathJoin(directory, f), 'utf8'));
	for (const [{name}] of walk(pkgs, p => p.packages)) {
		let prefixed = false;
		for (const pre of pres) {
			if (name.startsWith(pre)) {
				const after = name.substring(pre.length);
				if (after === '' || after[0] === '-' || after[0] === '.') {
					prefixed = true;
					break;
				}
			}
		}

		if (!prefixed && !misplacedChildren.has(name)) {
			throw new Error(`Package in wrong file: ${name}: ${f}`);
		}
	}
	return pkgs;
}

export async function read() {
	const files = (await readdir(directory, {recursive: true}))
		.filter(s => /^([^.][^/]*\/)*[^.][^/]*\.json$/.test(s))
		.sort(comparePaths);
	return (await Promise.all(files.map(readPackageFile))).flat();
}
