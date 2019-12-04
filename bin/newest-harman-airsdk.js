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

	let passed = new Set();
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
			console.log(`Error: Status code: ${response.statusCode}`);
			console.log('');
			continue;
		}

		const size = +response.headers['content-length'];
		console.log(`Size: ${size}`);
		if (!expected.has(name)) {
			console.log(`Error: Unknown name: ${name}`);
			console.log('');
			continue;
		}

		const sized = expected.get(name);
		if (size !== sized) {
			console.log(`Error: Unexpected size: ${size}`);
			console.log('');
			continue;
		}

		passed.add(name);
		console.log('');
	}

	const end = Date.now();
	const failed = expected.size - passed.size;

	console.log(`Passed: ${passed.size}`);
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