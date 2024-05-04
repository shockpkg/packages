#!/usr/bin/env node

/* eslint-disable no-console */

import {createReadStream} from 'node:fs';
import {mkdir, rename, stat} from 'node:fs/promises';
import {join as pathJoin} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';

import {runtimes, userAgent} from '../util/harman.mjs';
import {download} from '../util/download.mjs';
import {Hasher, Progress, Void} from '../util/stream.mjs';
import {createPackageUrl} from '../util/ia.mjs';

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
				new Progress(size => {
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

	{
		const clear = process.stdout.isTTY
			? '\x1B[F'.repeat(resources.length)
			: '';
		const update = first => {
			let output = first ? '' : clear;
			for (const resource of resources) {
				const {
					info: {name},
					progress,
					hashes
				} = resource;
				const status = hashes
					? 'COMPLETE'
					: `%${(progress * 100).toFixed(2)}`;
				output += `${name}: ${status}\n`;
			}
			process.stdout.write(output);
		};

		update(true);
		const interval = setInterval(update, 1000);
		try {
			const q = [...resources];
			await Promise.all(
				new Array(threads).fill(0).map(async () => {
					while (q.length) {
						// eslint-disable-next-line no-await-in-loop
						await each(q.shift());
					}
				})
			);
		} finally {
			clearInterval(interval);
		}

		update();
	}

	console.log('-'.repeat(80));

	const doc = [];
	for (const {
		info: {name, file},
		size,
		hashes: {sha256, sha1, md5}
	} of resources) {
		doc.push({
			name,
			file,
			size,
			sha256,
			sha1,
			md5,
			source: createPackageUrl(sha256, file)
		});
	}
	console.log(JSON.stringify(doc, null, '\t'));
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
