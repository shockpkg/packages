#!/usr/bin/env node

import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, join as pathJoin} from 'node:path';

import {read as packaged} from '../util/packages.mjs';

const dist = 'dist';
const file = 'packages.json';

async function outputFile(file, data) {
	await mkdir(dirname(file), {recursive: true});
	await writeFile(file, data);
}

function transform(packages, version) {
	const keys = new Map([
		['name', null],
		['file', null],
		['size', null],
		['sha256', null],
		['sha1', null],
		['md5', null],
		['zipped', null],
		['source', null],
		['packages', v => transform(v, version)]
	]);
	return packages.map(o => {
		const a = [];
		for (const [k, v] of Object.entries(o)) {
			if (keys.has(k)) {
				a.push([k, (keys.get(k) || (v => v))(v)]);
			}
		}
		return Object.fromEntries(a);
	});
}

async function main() {
	const packages = await packaged();
	for (const v of [1]) {
		// eslint-disable-next-line no-await-in-loop
		await outputFile(
			pathJoin(dist, 'api', `${v}`, file),
			JSON.stringify({
				format: '1.2',
				packages: transform(packages, v)
			})
		);
	}
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
