#!/usr/bin/env node

/* eslint-disable no-console */

import {sdks, cookies, userAgent} from '../util/harman.mjs';
import {read as packaged} from '../util/packages.mjs';
import {retry} from '../util/util.mjs';

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = +process.env.SHOCKPKG_NEWEST_THREADS || 4;

	console.log(`Threads: ${threads}`);

	const packages = await packaged();
	const named = new Map(packages.map(p => [p.name, p]));
	const listed = await sdks();
	const resources = listed.downloads;
	const cookie = cookies(listed.cookies);

	const each = async resource => {
		const {name, source} = resource;

		const expected = named.get(name);
		if (!expected) {
			throw new Error(`Unknown name: ${name}`);
		}

		const response = await retry(() =>
			fetch(source, {
				method: 'HEAD',
				headers: {
					'User-Agent': userAgent,
					Cookie: cookie
				}
			})
		);

		const {status, headers} = response;
		if (status !== 200) {
			throw new Error(`Status code: ${status}: ${source}`);
		}

		const size = +headers.get('content-length');
		const sized = expected.size;
		if (size !== sized) {
			throw new Error(`Unexpected size: ${size} != ${sized}`);
		}
	};

	const passed = [];
	const failed = [];
	await Promise.all(
		new Array(threads).fill(0).map(async () => {
			while (resources.length) {
				const resource = resources.shift();

				console.log(`${resource.name}: ${resource.source}: Checking`);

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
			}
		})
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
