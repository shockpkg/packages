#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const path = require('path');

const fse = require('fs-extra');

const gencache = require('../util/gencache');
const hash = require('../util/hash');
const yaml = require('../util/yaml');

const packagesDir = path.join(path.dirname(__dirname), 'packages');

function genList(version) {
	return [
		[
			`air-runtime-${version}-windows`,
			'https://airsdk.harman.com/assets/downloads/AdobeAIR.exe'
		],
		[
			`air-runtime-${version}-mac`,
			'https://airsdk.harman.com/assets/downloads/AdobeAIR.dmg'
		]
	];
}

async function main() {
	const args = process.argv.slice(2);
	if (args.length < 1) {
		throw new Error('Missing version argument');
	}
	const [version] = args;

	const file = path.join(packagesDir, 'air-runtime', `${version}.yaml`);

	const doc = [];
	const list = genList(version);
	for (const [name, url] of list) {
		console.log(`Name: ${name}`);
		console.log(`URL: ${url}`);

		// eslint-disable-next-line no-await-in-loop
		const cached = await gencache.ensure(name, url, progress => {
			const percent = progress * 100;
			process.stdout.write(`\rDownloading: ${percent.toFixed(2)}%\r`);
		});
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

		const file = url.split('/').pop();
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
