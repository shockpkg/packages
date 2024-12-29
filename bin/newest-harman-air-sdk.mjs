#!/usr/bin/env node

import {read as packaged} from '../util/packages.mjs';
import {retry} from '../util/util.mjs';
import {queue} from '../util/queue.mjs';
import {getUserAgent} from '../util/ff.mjs';
import {sdks, cookies, sdksList} from '../util/harman.mjs';

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = +process.env.SHOCKPKG_NEWEST_THREADS || 4;

	console.log(`Threads: ${threads}`);

	const packages = await packaged();
	const named = new Map(packages.map(p => [p.name, p]));
	const userAgent = await getUserAgent();
	const current = await sdks(userAgent);
	const resources = current.downloads;
	const cookie = cookies(current.cookies);
	const releases = await sdksList(userAgent);

	const all = [...resources];
	{
		const named = new Set(all.map(p => p.name));
		for (const release of releases) {
			if (!named.has(release.name)) {
				all.push(release);
			}
		}
	}

	const each = async resource => {
		const {name, source, url} = resource;

		const expected = named.get(name);
		if (!expected) {
			throw new Error(`Unknown name: ${name}`);
		}

		if (!url) {
			return;
		}

		const response = await retry(() =>
			fetch(url, {
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
	await queue(
		all,
		async resource => {
			console.log(`${resource.name}: Check: ${resource.source}`);

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
