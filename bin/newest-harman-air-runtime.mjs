#!/usr/bin/env node

/* eslint-disable no-console */

import {readdir} from 'fs/promises';
import {dirname} from 'path';
import {fileURLToPath} from 'url';

import {read as packageRead} from '../util/package.mjs';
import {buffer as hashBuffer} from '../util/hash.mjs';
import {userAgent} from '../util/harman-airsdk.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const pkgsdir = `${__dirname}/../packages/air-runtime`;

function propSorter(i) {
	return (a, b) => a[i] - b[i];
}

async function newest() {
	const vers = [];
	for (const f of await readdir(pkgsdir)) {
		if (f.startsWith('.')) {
			continue;
		}
		const parts = f.split('.yaml');
		if (parts.length < 2) {
			continue;
		}
		vers.push(parts[0].split('.').map(Number));
	}
	vers.sort(propSorter(3));
	vers.sort(propSorter(2));
	vers.sort(propSorter(1));
	vers.sort(propSorter(0));
	return vers.pop().join('.');
}

async function main() {
	const start = Date.now();
	const passed = new Set();
	const failed = new Set();

	const version = await newest();
	const expected = (await packageRead('air-runtime', version))
		.map(p => [p.name, p.file, p.size, p.sha256]);
	for (const [name, file, sized, sha256] of expected) {
		const source = `https://airsdk.harman.com/assets/downloads/${file}`;

		console.log(`Checking: ${name}`);
		console.log(`URL: ${source}`);

		// eslint-disable-next-line no-await-in-loop
		const response = await fetch(source, {
			'User-Agent': userAgent
		});
		if (response.status !== 200) {
			failed.add(name);
			console.log(`Error: Status code: ${response.status}`);
			console.log('');
			continue;
		}

		const size = +response.headers.get('content-length');
		if (size !== sized) {
			failed.add(name);
			console.log(`Error: Unexpected size: ${size} != ${sized}`);
			console.log('');
			continue;
		}

		// eslint-disable-next-line no-await-in-loop
		const body = Buffer.from(await response.arrayBuffer());
		const [rSha256] = hashBuffer(body, ['sha256']);
		if (rSha256 !== sha256) {
			failed.add(name);
			console.log(`Error: Unexpected sha256: ${rSha256} != ${sha256}`);
			console.log('');
			continue;
		}

		passed.add(name);
		console.log('');
	}

	const end = Date.now();

	console.log(`Passed: ${passed.size}`);
	console.log(`Failed: ${failed.size}`);
	console.log(`Done after ${end - start}ms`);
	console.log('');

	if (failed.size) {
		process.exitCode = 1;
	}
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
