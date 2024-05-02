#!/usr/bin/env node

/* eslint-disable no-console */

import {mkdir, stat} from 'node:fs/promises';

import {list, userAgent} from '../util/flashcn.mjs';
import {file as hashFile} from '../util/hash.mjs';
import {read as packaged} from '../util/packages.mjs';
import {walk} from '../util/util.mjs';
import {download} from '../util/download.mjs';

async function main() {
	const args = process.argv.slice(2);
	if (args.length < 1) {
		throw new Error('Args: outdir');
	}

	const [outdir] = args;

	const packages = await packaged();
	const bySha256 = new Map(
		[...walk(packages, p => p.packages)].map(([p]) => [p.sha256, p])
	);

	const all = await list();
	const doc = [];

	for (const info of all) {
		const {name, source, referer, file, date} = info;
		console.log(`Name: ${name}`);
		console.log(`URL: ${source}`);

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
				`${source}?_=${Date.now()}`,
				{
					'User-Agent': userAgent,
					Referer: referer
				},
				({size, total}) => {
					const p = (size / total) * 100;
					process.stdout.write(`\rDownloading: ${p.toFixed(2)}%\r`);
				}
			);
			console.log('');

			// eslint-disable-next-line no-await-in-loop
			st = await stat(filepath);
		}

		const {size} = st;
		console.log(`Size: ${size}`);

		// eslint-disable-next-line no-await-in-loop
		const [sha256, sha1, md5] = await hashFile(
			filepath,
			['sha256', 'sha1', 'md5'],
			'hex'
		);
		console.log(`SHA256: ${sha256}`);
		console.log(`SHA1: ${sha1}`);
		console.log(`MD5: ${md5}`);

		if (bySha256.has(sha256)) {
			console.log('UNCHANGED');
			console.log('');
			continue;
		}

		doc.push({
			name,
			file,
			size,
			sha256,
			sha1,
			md5,
			source: [
				`https://archive.org/download/shockpkg_packages_${sha256[0]}`,
				sha256.substr(0, 2),
				sha256.substr(2, 2),
				sha256.substr(4),
				file
			].join('/'),
			metadata: {
				date
			}
		});

		console.log('');
	}

	console.log('Done');
	console.log('-'.repeat(80));
	console.log(JSON.stringify(doc, null, '\t'));
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
