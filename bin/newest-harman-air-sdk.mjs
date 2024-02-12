#!/usr/bin/env node

/* eslint-disable no-console */

import {list, cookies, userAgent} from '../util/harman-airsdk.mjs';
import {read as packageRead} from '../util/package.mjs';
import {retry} from '../util/retry.mjs';

async function main() {
	const start = Date.now();
	const passed = new Set();
	const failed = new Set();

	const listed = await list();
	const cookie = cookies(listed.cookies);
	for (const {name, version, source} of listed.downloads) {
		console.log(`Checking: ${name}`);
		console.log(`URL: ${source}`);

		const expected = new Map(
			// eslint-disable-next-line no-await-in-loop
			(await packageRead('air-sdk', version).catch(_ => []))
				.map(p => [p.name, p.size])
		);

		// eslint-disable-next-line no-await-in-loop
		const response = await retry(() => fetch(source, {
			method: 'HEAD',
			headers: {
				'User-Agent': userAgent,
				Cookie: cookie
			}
		}));
		const {status, headers} = response;
		if (status !== 200) {
			failed.add(name);
			console.log(`Error: Status code: ${status}: ${source}`);
			console.log('');
			continue;
		}

		const size = +headers.get('content-length');
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
