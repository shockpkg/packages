#!/usr/bin/env node

/* eslint-disable no-console */

import {stat} from 'fs/promises';

import {ensure} from '../util/gencache.mjs';
import {file as hashFile} from '../util/hash.mjs';
import {packages as encodePackages} from '../util/yaml.mjs';

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
	for (const [name, url] of genList(version)) {
		console.log(`Name: ${name}`);
		console.log(`URL: ${url}`);

		// eslint-disable-next-line no-await-in-loop
		const cached = await ensure(
			name,
			url,
			progress => {
				const p = progress * 100;
				process.stdout.write(`\rDownloading: ${p.toFixed(2)}%\r`);
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
			await hashFile(cached.filepath, ['sha256', 'sha1', 'md5']);
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
	console.log(encodePackages(doc));
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
