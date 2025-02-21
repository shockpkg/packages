#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

import {read as packaged} from '../util/packages.mjs';
import {Hasher, Void} from '../util/stream.mjs';
import {retry} from '../util/util.mjs';
import {queue} from '../util/queue.mjs';
import {getUserAgent} from '../util/ff.mjs';
import {runtimes} from '../util/harun.mjs';

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = +process.env.SHOCKPKG_NEWEST_THREADS || 4;

	console.log(`Threads: ${threads}`);

	const packages = await packaged();
	const byName = new Map(packages.map(p => [p.name, p]));
	const userAgent = await getUserAgent();
	const resources = await runtimes(userAgent);

	const each = async resource => {
		const {name, source, sha256, headers} = resource;

		const pkg = byName.get(name);
		if (!pkg) {
			throw new Error(`Unknown name: ${name}`);
		}

		if (sha256 !== pkg.sha256) {
			throw new Error(`Different sha256: ${sha256} != ${pkg.sha256}`);
		}

		const response = await retry(() =>
			fetch(source, {
				headers
			})
		);

		const {status, body} = response;
		if (status !== 200) {
			throw new Error(`Status code: ${status}: ${source}`);
		}

		const hashSha256 = createHash('sha256');
		await pipeline(
			Readable.fromWeb(body),
			new Hasher([hashSha256]),
			new Void()
		);

		const bodySha256 = hashSha256.digest('hex');
		if (bodySha256 !== sha256) {
			throw new Error(`Body sha256: ${bodySha256} !== ${sha256}`);
		}
	};

	const passed = [];
	const failed = [];
	await queue(
		resources,
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
