#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const path = require('path');

const fse = require('fs-extra');

const gencache = require('../util/gencache');
const hash = require('../util/hash');
const yaml = require('../util/yaml');
const harmanAirsdk = require('../util/harman-airsdk');

const packagesDir = path.join(path.dirname(__dirname), 'packages');

async function main() {
	const list = await harmanAirsdk.list();
	const headers = {
		Cookie: harmanAirsdk.cookies(list.cookies)
	};
	const file = path.join(packagesDir, 'air-sdk', `${list.version}.yaml`);

	const doc = [];
	for (const {name, file, source: url} of list.downloads) {
		console.log(`Name: ${name}`);
		console.log(`URL: ${url}`);

		// eslint-disable-next-line no-await-in-loop
		const cached = await gencache.ensure(name, url, progress => {
			const percent = progress * 100;
			process.stdout.write(`\rDownloading: ${percent.toFixed(2)}%\r`);
		}, headers);
		if (cached.downloaded) {
			console.log('');
		}
		else {
			console.log('Cached');
		}

		// eslint-disable-next-line no-await-in-loop
		const stat = await fse.stat(cached.filepath);
		const {size} = stat;
		console.log(`Size: ${size}`);

		// eslint-disable-next-line no-await-in-loop
		const sha256 = await hash.file(cached.filepath, 'sha256');
		console.log(`SHA256: ${sha256}`);
		// eslint-disable-next-line no-await-in-loop
		const sha1 = await hash.file(cached.filepath, 'sha1');
		console.log(`SHA1: ${sha1}`);
		// eslint-disable-next-line no-await-in-loop
		const md5 = await hash.file(cached.filepath, 'md5');
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

	console.log(`Writing: ${file}`);

	const data = yaml.packages(doc);
	await fse.writeFile(file, data, 'utf8');

	console.log('Done');
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
