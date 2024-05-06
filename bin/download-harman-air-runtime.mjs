#!/usr/bin/env node

/* eslint-disable no-console */

import {createReadStream} from 'node:fs';
import {mkdir, rename, stat, writeFile} from 'node:fs/promises';
import {dirname, join as pathJoin} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';

import {runtimes, userAgent} from '../util/harman.mjs';
import {download} from '../util/download.mjs';
import {Hasher, Counter, Void} from '../util/stream.mjs';
import {queue} from '../util/queue.mjs';
import {createPackageUrl} from '../util/ia.mjs';
import {Progress} from '../util/tui.mjs';
import {directory} from '../util/packages.mjs';

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = +process.env.SHOCKPKG_DOWNLOAD_THREADS || 4;

	const args = process.argv.slice(2);
	if (args.length < 1) {
		throw new Error('Args: outdir');
	}

	const [outdir] = args;

	const resources = (await runtimes()).map(info => ({
		info,
		progress: 0,
		size: null,
		hashes: null
	}));

	const each = async resource => {
		const {name, source, file, mimetype, sha256: sha256e} = resource.info;
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
			await mkdir(fileDir, {recursive: true});
			await download(filePart, source, {
				headers: {
					'User-Agent': userAgent
				},
				transforms: [hasher],
				response(response) {
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
			st = await stat(filePart);
			await rename(filePart, filePath);
		}

		resource.size = st.size;

		const sha256 = hashSha256.digest('hex');
		if (sha256 !== sha256e) {
			throw new Error(`Hash: ${sha256} != ${sha256e}: ${source}`);
		}

		resource.hashes = {
			sha256,
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

	for (const {
		info: {name, file, group},
		size,
		hashes: {sha256, sha1, md5}
	} of resources) {
		const pkg = {
			name,
			file,
			size,
			sha256,
			sha1,
			md5,
			source: createPackageUrl(sha256, file)
		};
		const json = JSON.stringify(pkg, null, '\t');
		const f = pathJoin(...group, `${name}.json`);

		console.log(f);
		console.log(json);

		// eslint-disable-next-line no-await-in-loop
		await mkdir(dirname(f), {recursive: true});
		// eslint-disable-next-line no-await-in-loop
		await writeFile(pathJoin(directory, f), `${json}\n`);
	}
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
