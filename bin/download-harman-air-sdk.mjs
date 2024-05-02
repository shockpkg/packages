#!/usr/bin/env node

/* eslint-disable no-console */

import {mkdir, stat} from 'node:fs/promises';

import {file as hashFile} from '../util/hash.mjs';
import {sdks, cookies, userAgent} from '../util/harman.mjs';
import {download} from '../util/download.mjs';
import {packageUrl} from '../util/ia.mjs';

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = +process.env.SHOCKPKG_DOWNLOAD_THREADS || 4;

	const args = process.argv.slice(2);
	if (args.length < 1) {
		throw new Error('Args: outdir');
	}

	const [outdir] = args;

	const listed = await sdks();
	const cookieHeader = cookies(listed.cookies);

	const resources = listed.downloads.map(info => ({
		info,
		download: 0,
		size: null,
		hashes: null
	}));

	const each = async resource => {
		const {name, source, file} = resource.info;
		const filedir = `${outdir}/${name}`;
		const filepath = `${filedir}/${file}`;

		// eslint-disable-next-line no-await-in-loop
		let st = await stat(filepath).catch(() => null);
		if (!st) {
			// eslint-disable-next-line no-await-in-loop
			await mkdir(filedir, {recursive: true});

			// eslint-disable-next-line no-await-in-loop
			await download(
				filepath,
				source,
				{
					'User-Agent': userAgent,
					Cookie: cookieHeader
				},
				({size, total}) => {
					resource.download = size / total;
				}
			);

			// eslint-disable-next-line no-await-in-loop
			st = await stat(filepath);
		}

		resource.size = st.size;
		resource.download = 1;

		const [sha256, sha1, md5] = await hashFile(
			filepath,
			['sha256', 'sha1', 'md5'],
			'hex'
		);
		resource.hashes = {sha256, sha1, md5};
	};

	{
		const clear = '\x1B[F'.repeat(resources.length);
		const update = first => {
			if (!first) {
				process.stdout.write(clear);
			}
			for (const resource of resources) {
				const {
					info: {name},
					download,
					hashes
				} = resource;
				const status = hashes
					? 'COMPLETE'
					: `%${(download * 100).toFixed(2)}`;
				process.stdout.write(`${name}: ${status}\n`);
			}
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
			update();
		}
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
			source: packageUrl(sha256, file)
		});
	}
	console.log(JSON.stringify(doc, null, '\t'));
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
