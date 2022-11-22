#!/usr/bin/env node

/* eslint-disable no-console */

import fetch from 'node-fetch';

import {list, userAgent} from '../util/flashcn.mjs';
import {flat} from '../util/packages.mjs';

const byName = new Map(flat.map(o => [o.name, o]));

async function main() {
	const start = Date.now();
	const passed = new Set();
	const failed = new Set();

	const all = await list();
	for (const {name, source, referer, date} of all) {
		console.log(`Checking: ${name}`);
		console.log(`URL: ${source}`);

		const pkg = byName.get(name);
		const dated = pkg.metadata?.date;
		if (!date || !pkg) {
			failed.add(name);
			console.log(`Error: Unknown package: ${name}`);
			console.log('');
			continue;
		}

		if (date !== dated) {
			failed.add(name);
			console.log(`Error: Unexpected date: ${date} != ${dated}`);
			console.log('');
			continue;
		}

		// eslint-disable-next-line no-await-in-loop
		const response = await fetch(`${source}?_=${Date.now()}`, {
			method: 'HEAD',
			headers: {
				'User-Agent': userAgent,
				Referer: referer
			}
		});

		if (response.status !== 200) {
			failed.add(name);
			console.log(`Error: Status code: ${response.status}`);
			console.log('');
			continue;
		}

		const size = +response.headers.get('content-length');
		const sized = pkg.size;
		if (size !== sized) {
			failed.add(name);
			console.log(`Error: Unexpected size: ${size} != ${sized}`);
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
