#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const {requestPromise} = require('../util/request');
const harmanAirsdk = require('../util/harman-airsdk');

const expected = new Map([
	['air-sdk-33.0.2.330-windows', 613934804],
	['air-sdk-33.0.2.330-windows-compiler', 650977571],
	['air-sdk-33.0.2.330-mac', 580630420],
	['air-sdk-33.0.2.330-mac-compiler', 617673128]
]);

async function main() {
	const start = Date.now();

	let failed = 0;
	let passed = 0;
	const list = await harmanAirsdk.list();
	const cookie = harmanAirsdk.cookies(list.cookies);
	for (const {name, source} of list.downloads) {
		console.log(`Checking: ${name}`);
		console.log(`URL: ${source}`);

		// eslint-disable-next-line no-await-in-loop
		const {response} = await requestPromise({
			method: 'HEAD',
			url: source,
			headers: {
				Cookie: cookie
			}
		});

		if (response.statusCode !== 200) {
			console.log(
				`Error: ${name}: Status code: ${response.statusCode}`
			);
			console.log('');
			failed++;
			continue;
		}

		const size = +response.headers['content-length'];
		console.log(`Size: ${size}`);
		if (!expected.has(name)) {
			console.log(
				`Error: ${name}: Unknown name: ${name}`
			);
			console.log('');
			failed++;
			continue;
		}

		const sized = expected.get(name);
		if (size !== sized) {
			console.log(
				`Error: ${name}: Unexpected size: ${size}`
			);
			console.log('');
			failed++;
			continue;
		}

		passed++;
		console.log('');
	}
	failed += expected.size - passed;

	const end = Date.now();

	console.log(`Passed: ${passed}`);
	console.log(`Failed: ${failed}`);
	console.log(`Done after ${end - start}ms`);
	console.log('');

	if (failed) {
		process.exitCode = 1;
	}
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
