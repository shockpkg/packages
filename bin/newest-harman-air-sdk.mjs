#!/usr/bin/env node

/* eslint-disable no-console */

import fetch from 'node-fetch';

import {list, cookies, userAgent} from '../util/harman-airsdk.mjs';
import {read as packageRead} from '../util/package.mjs';

async function main() {
	const start = Date.now();
	const passed = new Set();
	const failed = new Set();

	const listed = await list();
	const expected = new Map(
		(await packageRead('air-sdk', listed.version))
			.map(p => [p.name, p.size])
	);
	const cookie = cookies(listed.cookies);
	for (const {name, source} of listed.downloads) {
		console.log(`Checking: ${name}`);
		console.log(`URL: ${source}`);

		// eslint-disable-next-line no-await-in-loop
		const response = await fetch(source, {
			method: 'HEAD',
			headers: {
				'User-Agent': userAgent,
				Cookie: cookie
			}
		});
		if (response.status !== 200) {
			failed.add(name);
			console.log(`Error: Status code: ${response.status}`);
			console.log('');
			continue;
		}

		const size = +response.headers.get('content-length');
		console.log(`Size: ${size}`);
		if (!expected.has(name)) {
			failed.add(name);
			console.log(`Error: Unknown name: ${name}`);
			console.log('');
			continue;
		}

		const sized = expected.get(name);
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
