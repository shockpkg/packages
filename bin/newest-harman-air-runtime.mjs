#!/usr/bin/env node

/* eslint-disable no-console */

import packaged from '../util/packages.mjs';
import {buffer as hashBuffer} from '../util/hash.mjs';
import {userAgent} from '../util/harman.mjs';
import {retry} from '../util/util.mjs';

function list() {
	return ['AdobeAIR.exe', 'AdobeAIR.dmg'].map(file => ({
		file,
		source: `https://airsdk.harman.com/assets/downloads/${file}`
	}));
}

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = (+process.env.SHOCKPKG_NEWEST_THREADS) || 4;

	console.log(`Threads: ${threads}`);

	const packages = await packaged();
	const hashed = new Map(packages.map(p => [p.sha256, p]));
	const resources = list();

	const each = async resource => {
		const {source} = resource;

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

		// eslint-disable-next-line no-await-in-loop
		const body = Buffer.from(await response.arrayBuffer());
		const [sha256] = hashBuffer(body, ['sha256']);
		if (!hashed.get(sha256)) {
			throw new Error(`Unknown sha256: ${sha256}`);
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
