#!/usr/bin/env node

/* eslint-disable no-console */

import {createReadStream} from 'node:fs';
import {mkdir, rename, stat} from 'node:fs/promises';
import {join as pathJoin} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';

import {downloads, userAgent} from '../util/flashcn.mjs';
import {read as packaged} from '../util/packages.mjs';
import {walk} from '../util/util.mjs';
import {queue} from '../util/queue.mjs';
import {download} from '../util/download.mjs';
import {Hasher, Counter, Void} from '../util/stream.mjs';
import {Crc64} from '../util/crc64.mjs';
import {createPackageUrl} from '../util/ia.mjs';
import {Progress} from '../util/tui.mjs';

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = +process.env.SHOCKPKG_DOWNLOAD_THREADS || 4;

	const args = process.argv.slice(2);
	if (args.length < 1) {
		throw new Error('Args: outdir');
	}

	const [outdir] = args;

	const packages = await packaged();
	const bySha256 = new Map(
		[...walk(packages, p => p.packages)].map(([p]) => [p.sha256, p])
	);

	const resources = (await downloads()).map(info => ({
		info,
		progress: 0,
		size: null,
		hashes: null
	}));

	const each = async resource => {
		const {name, source, referer, file, mimetype} = resource.info;
		const fileDir = pathJoin(outdir, name);
		const filePath = pathJoin(fileDir, file);
		const filePart = `${filePath}.part`;

		const hashSha256 = createHash('sha256');
		const hashSha1 = createHash('sha1');
		const hashMd5 = createHash('md5');
		const hasher = new Hasher([hashSha256, hashSha1, hashMd5]);

		let st = await stat(filePath).catch(() => null);
		if (st) {
			const total = st.size;
			await pipeline(
				createReadStream(filePath),
				hasher,
				new Counter(size => {
					resource.progress = size / total;
				}),
				new Void()
			);
		} else {
			const hashCrc64 = new Crc64();
			let crc64ecma = null;
			await mkdir(fileDir, {recursive: true});
			await download(filePart, `${source}?_=${Date.now()}`, {
				headers: {
					'User-Agent': userAgent,
					Referer: referer
				},
				transforms: [new Hasher([hashCrc64]), hasher],
				response(response) {
					crc64ecma = response.headers.get('x-cos-hash-crc64ecma');
					const ct = response.headers.get('content-type');
					if (ct !== mimetype) {
						throw new Error(
							`Mimetype: ${ct} != ${mimetype}: ${source}`
						);
					}
				},
				progress({size, total}) {
					resource.progress = size / total;
				}
			});

			// Validate crc64ecma hash header.
			const crc64 = hashCrc64.digest().readBigUint64BE().toString();
			if (crc64 !== crc64ecma) {
				throw new Error(`CRC64 header: ${crc64} !== ${crc64ecma}`);
			}

			st = await stat(filePart);
			await rename(filePart, filePath);
		}

		resource.size = st.size;

		resource.hashes = {
			sha256: hashSha256.digest('hex'),
			sha1: hashSha1.digest('hex'),
			md5: hashMd5.digest('hex')
		};
	};

	const progress = new (class extends Progress {
		line(resource) {
			const status = resource.hashes
				? 'DONE'
				: `%${(resource.progress * 100).toFixed(2)}`;
			return `${resource.info.name}: ${status}`;
		}
	})(resources);
	progress.start(1000);
	try {
		await queue(resources, each, threads);
	} finally {
		progress.end();
	}

	console.log('-'.repeat(80));

	const unchanged = resources.filter(r => bySha256.has(r.hashes.sha256));
	const changed = resources.filter(r => !bySha256.has(r.hashes.sha256));

	console.log(`UNCHANGED: ${unchanged.length}`);
	for (const r of unchanged) {
		console.log(r.info.name);
	}

	console.log('-'.repeat(80));

	console.log(`CHANGED: ${changed.length}`);
	for (const r of changed) {
		console.log(r.info.name);
	}

	console.log('-'.repeat(80));

	const doc = [];
	for (const {
		info: {name, file, date},
		size,
		hashes: {sha256, sha1, md5}
	} of changed) {
		doc.push({
			name,
			file,
			size,
			sha256,
			sha1,
			md5,
			source: createPackageUrl(sha256, file),
			metadata: {
				date
			}
		});
	}
	console.log(JSON.stringify(doc, null, '\t'));
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
