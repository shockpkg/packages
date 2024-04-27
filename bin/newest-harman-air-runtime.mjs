#!/usr/bin/env node

/* eslint-disable no-console */

import {read as readPackages} from '../util/packages.mjs';
import {buffer as hashBuffer} from '../util/hash.mjs';
import {userAgent} from '../util/harman-airsdk.mjs';
import {retry} from '../util/retry.mjs';

const files = [
	'AdobeAIR.exe',
	'AdobeAIR.dmg'
];

async function main() {
	const start = Date.now();
	const passed = new Set();
	const failed = new Set();

	const packages = await readPackages();
	const hashed = new Map(packages.map(p => [p.sha256, p]));

	for (const file of files) {
		console.log(`Checking: ${file}`);

		const source = `https://airsdk.harman.com/assets/downloads/${file}`;
		console.log(`URL: ${source}`);

		// eslint-disable-next-line no-await-in-loop
		const response = await retry(() => fetch(source, {
			'User-Agent': userAgent
		}));
		const {status} = response;
		if (status !== 200) {
			failed.add(file);
			console.log(`Error: Status code: ${status}: ${source}`);
			console.log('');
			continue;
		}

		// eslint-disable-next-line no-await-in-loop
		const body = Buffer.from(await response.arrayBuffer());
		const [sha256] = hashBuffer(body, ['sha256']);
		if (!hashed.get(sha256)) {
			failed.add(file);
			console.log(`Error: Unknown sha256: ${sha256}`);
			console.log('');
			continue;
		}

		passed.add(file);
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
