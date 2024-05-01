#!/usr/bin/env node

/* eslint-disable no-console */

import {Readable} from 'node:stream';

import packaged from '../util/packages.mjs';
import {stream as hashStream} from '../util/hash.mjs';
import {runtimes, userAgent} from '../util/harman.mjs';
import {retry} from '../util/util.mjs';

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = (+process.env.SHOCKPKG_NEWEST_THREADS) || 4;

	console.log(`Threads: ${threads}`);

	const packages = await packaged();
	const byName = new Map(packages.map(p => [p.name, p]));
	const resources = await runtimes();

	const each = async resource => {
		const {name, source, sha256} = resource;

		const pkg = byName.get(name);
		if (!pkg) {
			throw new Error(`Unknown name: ${name}`);
		}

		if (sha256 !== pkg.sha256) {
			throw new Error(`Different sha256: ${sha256} != ${pkg.sha256}`);
		}

		// eslint-disable-next-line no-await-in-loop
		const response = await retry(() => fetch(source, {
			headers: {
				'User-Agent': userAgent
			}
		}));

		const {status} = response;
		if (status !== 200) {
			throw new Error(`Status code: ${status}: ${source}`);
		}

		const stream = Readable.fromWeb(response.body);

		// eslint-disable-next-line no-await-in-loop
		const [bodyHash] = await hashStream(stream, ['sha256']);
		if (bodyHash !== sha256) {
			throw new Error(`Body sha256: ${bodyHash} !== ${sha256}`);
		}
	};

	const passed = [];
	const failed = [];
	await Promise.all((new Array(threads)).fill(0)
		.map(async () => {
			while (resources.length) {
				const resource = resources.shift();

				console.log(`${resource.file}: ${resource.source}: Checking`);

				// eslint-disable-next-line no-await-in-loop
				await retry(() => each(resource))
					.then(() => {
						console.log(`${resource.file}: Pass`);
						passed.push(resource);
					})
					.catch(err => {
						console.log(`${resource.file}: Fail: ${err.message}`);
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
