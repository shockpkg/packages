import {readFile, readdir} from 'node:fs/promises';
import {basename, dirname, join as pathJoin} from 'node:path';
import {fileURLToPath} from 'node:url';

import {walk} from './util.mjs';
import {humanTokens} from './compare.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const directory = pathJoin(__dirname, '..', 'packages');

const jsonPathReg = /^([^.][^/]*\/)*[^.][^/]*\.json$/;

const andReg = /^(.*)-([\d.]+)-and-([\d.]+|higher)$/;

const misplacedChildren = new Map([
	['flash-player-2-java', 'flash-player-3'],
	['flash-player-9.0.262.0-linux-sa', 'flash-player-10']
]);

function compareNames(a, b) {
	return humanTokens(a.name.split('-'), b.name.split('-'));
}

export async function readPackageFile(f) {
	const named = basename(f, '.json');
	const pre = dirname(f).replace(/[\\/]/g, '-');
	const pres = [pre];
	const m = pre.match(andReg);
	if (m) {
		pres.push(`${m[1]}-${m[2]}`);
		if (m[3] !== 'higher') {
			pres.push(`${m[1]}-${m[3]}`);
		}
	}

	const pkg = JSON.parse(await readFile(pathJoin(directory, f), 'utf8'));
	if (pkg.name !== named) {
		throw new Error(`Package name file mismatch: ${pkg.name}: ${f}`);
	}

	for (const [{name}] of walk([pkg], p => p.packages)) {
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

		if (!prefixed && misplacedChildren.get(name) !== pre) {
			throw new Error(`Package in wrong file: ${name}: ${f}`);
		}
	}
	return pkg;
}

export async function read() {
	const files = (await readdir(directory, {recursive: true})).filter(s =>
		jsonPathReg.test(s)
	);
	const pkgs = (await Promise.all(files.map(readPackageFile))).flat();
	for (const [pkg] of walk(pkgs, p => p.packages)) {
		pkg.packages?.sort(compareNames);
	}
	pkgs.sort(compareNames);
	return pkgs;
}
