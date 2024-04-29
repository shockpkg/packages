#!/usr/bin/env node

/* eslint-disable no-console */

import packaged from '../util/packages.mjs';
import {retry} from '../util/util.mjs';

function archiveOrgParse(url) {
	const u = new URL(url);
	if (u.host !== 'archive.org') {
		return null;
	}
	const path = u.pathname.split('/');
	if (path.shift() !== '') {
		return null;
	}
	if (path.shift() !== 'download') {
		return null;
	}
	const item = path.shift();
	return {
		item,
		path: decodeURI(path.join('/'))
	};
}

const iaCache = {};
// eslint-disable-next-line require-await
async function archiveOrgMetadata(item) {
	if (!iaCache[item]) {
		const url = `https://archive.org/metadata/${encodeURI(item)}/`;
		iaCache[item] = retry(() => fetch(url)).then(async response => {
			const {status} = response;
			if (status !== 200) {
				throw new Error(`Status code: ${status}: ${url}`);
			}
			const body = await response.text();
			const files = new Map();
			for (const file of JSON.parse(body).files) {
				const info = {
					size: +file.size,
					md5: file.md5,
					sha1: file.sha1
				};

				const maybeSha256 = file.name.split('/').slice(0, -1)
					.join('');
				if (maybeSha256.length === 64) {
					info.sha256 = maybeSha256;
				}

				if (file.private) {
					info.private = true;
				}

				files.set(file.name, info);
			}
			return files;
		});
	}
	return iaCache[item];
}

async function getMetadataForUrl(url) {
	const archiveOrg = archiveOrgParse(url);
	if (archiveOrg) {
		const metadata = await archiveOrgMetadata(archiveOrg.item);
		const info = metadata.get(archiveOrg.path);
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
}

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = (+process.env.SHOCKPKG_NEWEST_THREADS) || 4;
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
	await Promise.all((new Array(threads)).fill(0)
		.map(async () => {
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
