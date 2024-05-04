#!/usr/bin/env node

/* eslint-disable no-console */

import {downloads, userAgent} from '../util/flashcn.mjs';
import {read as packaged} from '../util/packages.mjs';
import {retry, walk} from '../util/util.mjs';
import {queue} from '../util/queue.mjs';

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = +process.env.SHOCKPKG_NEWEST_THREADS || 4;

	console.log(`Threads: ${threads}`);

	const packages = await packaged();
	const byName = new Map(
		[...walk(packages, p => p.packages)].map(([p]) => [p.name, p])
	);
	const resources = await downloads();

	console.log(`Checking: ${resources.length}`);

	const each = async resource => {
		const {name, source, referer, date} = resource;

		const pkg = byName.get(name);
		const dated = pkg?.metadata?.date;
		if (!date || !pkg) {
			throw new Error(`Unknown package: ${name}`);
		}

		if (date !== dated) {
			throw new Error(`Unexpected date: ${date} != ${dated}`);
		}

		const url = `${source}?_=${Date.now()}`;
		const response = await retry(() =>
			fetch(url, {
				method: 'HEAD',
				headers: {
					'User-Agent': userAgent,
					Referer: referer
				}
			})
		);

		const {status, headers} = response;
		if (status !== 200) {
			throw new Error(`Status code: ${status}: ${url}`);
		}

		const size = +headers.get('content-length');
		const sized = pkg.size;
		if (size !== sized) {
			throw new Error(`Unexpected size: ${size} != ${sized}`);
		}
	};

	const passed = [];
	const failed = [];
	await queue(
		resources,
		async resource => {
			console.log(`${resource.name}: Check: ${resource.source}`);

			// eslint-disable-next-line no-await-in-loop
			await retry(() => each(resource))
				.then(() => {
					console.log(`${resource.name}: Pass`);
					passed.push(resource);
				})
				.catch(err => {
					console.log(`${resource.name}: Fail: ${err.message}`);
					failed.push(resource);
				});
		},
		threads
	);

	console.log(`Passed: ${passed.length}`);
	console.log(`Failed: ${failed.length}`);

	if (failed.length) {
		process.exitCode = 1;
	}
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
