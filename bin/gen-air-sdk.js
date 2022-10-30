#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const {stat} = require('fs/promises');

const gencache = require('../util/gencache');
const hash = require('../util/hash');
const yaml = require('../util/yaml');

function genList(version) {
	const verstr = version
		.split('.')
		.slice(0, 2)
		.join('.');

	return [
		[
			`air-sdk-${version}-windows`,
			`https://fpdownload.macromedia.com/air/win/download/${verstr}/AdobeAIRSDK.zip`
		],
		[
			`air-sdk-${version}-windows-compiler`,
			`https://fpdownload.macromedia.com/air/win/download/${verstr}/AIRSDK_Compiler.zip`
		],
		[
			`air-sdk-${version}-mac`,
			`https://fpdownload.macromedia.com/air/mac/download/${verstr}/AdobeAIRSDK.dmg`
		],
		[
			`air-sdk-${version}-mac-compiler`,
			`https://fpdownload.macromedia.com/air/mac/download/${verstr}/AIRSDK_Compiler.dmg`
		]
	];
}

async function main() {
	const args = process.argv.slice(2);
	if (args.length < 1) {
		throw new Error('Missing version argument');
	}
	const [version] = args;

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
			file: url.split('/').pop(),
			size,
			sha256,
			sha1,
			md5,
			source: url
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
