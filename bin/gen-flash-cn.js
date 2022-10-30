#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const {stat} = require('fs/promises');

const {list, userAgent} = require('../util/flashcn');
const gencache = require('../util/gencache');
const hash = require('../util/hash');
const yaml = require('../util/yaml');

async function main() {
	const all = await list();
	const doc = [];

	for (const info of all) {
		const {name, source, file} = info;
		console.log(`Name: ${name}`);
		console.log(`URL: ${source}`);

		// eslint-disable-next-line no-await-in-loop
		const cached = await gencache.ensure(
			name,
			source,
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

		const [sha256, sha1, md5] =
			// eslint-disable-next-line no-await-in-loop
			await hash.file(cached.filepath, ['sha256', 'sha1', 'md5']);
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
	console.log(yaml.packages(doc));
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
