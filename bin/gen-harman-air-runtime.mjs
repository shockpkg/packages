#!/usr/bin/env node

/* eslint-disable no-console */

import {stat} from 'node:fs/promises';

import {ensure} from '../util/gencache.mjs';
import {file as hashFile} from '../util/hash.mjs';
import {runtimes, userAgent} from '../util/harman.mjs';

async function main() {
	const doc = [];
	const resources = await runtimes();
	for (const {name, file, sha256, source: url} of resources) {
		console.log(`Name: ${name}`);
		console.log(`URL: ${url}`);

		// eslint-disable-next-line no-await-in-loop
		const cached = await ensure(
			name,
			url,
			progress => {
				const p = progress * 100;
				process.stdout.write(`\rDownloading: ${p.toFixed(2)}%\r`);
			},
			{
				'User-Agent': userAgent
			}
		);
		if (cached.downloaded) {
			console.log('');
		}
		else {
			console.log('Cached');
		}

		// eslint-disable-next-line no-await-in-loop
		const {size} = await stat(cached.filepath);
		console.log(`Size: ${size}`);

		// eslint-disable-next-line no-await-in-loop
		const [fileSha256, sha1, md5] =	await hashFile(
			cached.filepath,
			['sha256', 'sha1', 'md5']
		);
		if (fileSha256 !== sha256) {
			throw new Error(`Unexpected sha256: ${fileSha256} != ${sha256}`);
		}

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
