#!/usr/bin/env node

/* eslint-disable no-console */

import {list, userAgent} from '../util/flashcn.mjs';
import {read as readPackages} from '../util/packages.mjs';
import {retry} from '../util/retry.mjs';
import {walk} from '../util/util.mjs';

async function main() {
	const packages = await readPackages();
	const byName = new Map(
		[...walk(packages, p => p.packages)].map(([p]) => [p.name, p])
	);

	const start = Date.now();
	const passed = new Set();
	const failed = new Set();

	const all = await list();
	for (const {name, source, referer, date} of all) {
		console.log(`Checking: ${name}`);
		console.log(`URL: ${source}`);

		const pkg = byName.get(name);
		const dated = pkg?.metadata?.date;
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

		const url = `${source}?_=${Date.now()}`;
		// eslint-disable-next-line no-await-in-loop
		const response = await retry(() => fetch(url, {
			method: 'HEAD',
			headers: {
				'User-Agent': userAgent,
				Referer: referer
			}
		}));

		const {status, headers} = response;
		if (status !== 200) {
			failed.add(name);
			console.log(`Error: Status code: ${status}: ${url}`);
			console.log('');
			continue;
		}

		const size = +headers.get('content-length');
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
