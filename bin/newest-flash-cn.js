#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {pipeline} from 'node:stream/promises';

import {read as packaged} from '../util/packages.js';
import {retry, walk} from '../util/util.js';
import {queue} from '../util/queue.js';
import {getUserAgent} from '../util/ff.js';
import {downloads} from '../util/flcn.js';

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = +process.env.SHOCKPKG_NEWEST_THREADS || 4;

	console.log(`Threads: ${threads}`);

	const packages = await packaged();
	const byName = new Map(
		[...walk(packages, p => p.packages)].map(([p]) => [p.name, p])
	);
	const bySha256 = new Map(
		[...walk(packages, p => p.packages)].map(([p]) => [p.sha256, p])
	);

	const userAgent = await getUserAgent();
	const resources = await downloads(userAgent);

	console.log(`Checking: ${resources.length}`);

	const messages = new Map();
	const each = async resource => {
		try {
			const {name, size, date} = resource;

			const pkg = byName.get(name);
			const dated = pkg?.metadata?.date;
			if (!date || !pkg) {
				throw new Error(`Unknown package: ${name}`);
			}

			if (date !== dated) {
				throw new Error(`Unexpected date: ${date} != ${dated}`);
			}

			let total;
			if (Number.isInteger(size) && size > 0) {
				total = size;
			} else {
				const {size} = await resource.download(true);
				total = size;
			}

			const sized = pkg.size;
			if (total !== sized) {
				throw new Error(`Unexpected size: ${size} != ${sized}`);
			}
		} catch (err) {
			// Sometimes older versions remain when newer versions publish.
			// Check if this variant is already known and ignore if it is.
			const {stream} = await resource.download();
			const hashSha256 = createHash('sha256');
			await pipeline(stream, hashSha256);
			const sha256 = hashSha256.digest('hex');
			if (bySha256.has(sha256)) {
				messages.set(resource, 'Known variant');
				return;
			}
			throw err;
		}
	};

	const passed = [];
	const failed = [];
	await queue(
		resources,
		async resource => {
			console.log(`${resource.name}: Check`);

			await retry(() => each(resource))
				.then(() => {
					let m = messages.get(resource);
					m = m ? `: ${m}` : '';
					console.log(`${resource.name}: Pass${m}`);
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
