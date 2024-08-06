#!/usr/bin/env node

import {read as packaged} from '../util/packages.mjs';
import {
	groupFilesCaching,
	groupForSha256,
	parsePackageUrl,
	pathForFile
} from '../util/ia.mjs';
import {retry} from '../util/util.mjs';

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = +process.env.SHOCKPKG_NEWEST_THREADS || 4;
	// eslint-disable-next-line no-process-env
	const includes = process.env.SHOCKPKG_VERIFY_INCLUDES || '';

	console.log(`Threads: ${threads}`);

	const packages = await packaged();
	let resources = packages;

	if (includes) {
		const str = JSON.stringify(includes);
		console.log(`Only checking those names including: ${str}`);
		resources = packages.filter(pkg => pkg.name.includes(includes));
	}

	console.log(`Checking ${resources.length} of ${packages.length}`);

	const archiveOrgMetadata = groupFilesCaching();

	const getMetadataForUrl = async url => {
		const ia = parsePackageUrl(url);
		if (ia) {
			const files = await archiveOrgMetadata(groupForSha256(ia.sha256));
			const info = files.get(pathForFile(ia.sha256, ia.file));
			if (!info) {
				throw new Error(`Unknown item entry: ${url}`);
			}
			return info;
		}

		const response = await retry(() => fetch(url));
		const {status, headers} = response;
		if (status !== 200) {
			throw new Error(`Status code: ${status}: ${url}`);
		}
		return {
			size: +headers.get('content-length')
		};
	};

	const each = async pkg => {
		const metadata = await getMetadataForUrl(pkg.source);

		if (metadata.size !== pkg.size) {
			throw new Error(
				`Unexpected size: ${metadata.size} (expected ${pkg.size})`
			);
		}

		for (const algo of ['md5', 'sha1', 'sha256']) {
			if (!metadata[algo]) {
				continue;
			}
			if (metadata[algo] === pkg[algo]) {
				continue;
			}
			throw new Error(
				`Unexpected ${algo}: ${metadata[algo]} (expected ${pkg[algo]})`
			);
		}

		if (metadata.private) {
			throw new Error('Unexpected private');
		}
	};

	const passed = [];
	const failed = [];
	await Promise.all(
		Array.from({length: threads})
			.fill(0)
			.map(async () => {
				while (resources.length) {
					const resource = resources.shift();

					console.log(
						`${resource.name}: ${resource.source}: Checking`
					);

					// eslint-disable-next-line no-await-in-loop
					await retry(() => each(resource))
						.then(() => {
							console.log(`${resource.name}: Pass`);
							passed.push(resource);
						})
						.catch(err => {
							console.log(
								`${resource.name}: Fail: ${err.message}`
							);
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
