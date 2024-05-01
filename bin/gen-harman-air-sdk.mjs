#!/usr/bin/env node

/* eslint-disable no-console */

import {mkdir, stat} from 'node:fs/promises';

import {file as hashFile} from '../util/hash.mjs';
import {sdks, cookies, userAgent} from '../util/harman.mjs';
import {download} from '../util/download.mjs';

async function main() {
	const listed = await sdks();
	const cookieHeader = cookies(listed.cookies);

	const doc = [];
	for (const {name, file, source} of listed.downloads) {
		console.log(`Name: ${name}`);
		console.log(`URL: ${source}`);

		const filepath = `${name}/${file}`;

		// eslint-disable-next-line no-await-in-loop
		let st = await stat(filepath).catch(() => null);
		if (!st) {
			// eslint-disable-next-line no-await-in-loop
			await mkdir(name, {recursive: true});

			// eslint-disable-next-line no-await-in-loop
			await download(
				filepath,
				source,
				{
					'User-Agent': userAgent,
					Cookie: cookieHeader
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

		const entry = {
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
			].join('/')
		};

		doc.push(entry);

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
