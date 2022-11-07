#!/usr/bin/env node

/* eslint-disable no-console */

import {stat} from 'fs/promises';

import {ensure} from '../util/gencache.mjs';
import {file as hashFile} from '../util/hash.mjs';
import {packages as encodePackages} from '../util/yaml.mjs';
import {userAgent} from '../util/harman-airsdk.mjs';

function genList(version, versioned) {
	const p = versioned ? `${version}/` : '';
	return [
		[
			`air-runtime-${version}-windows`,
			`https://airsdk.harman.com/assets/downloads/${p}AdobeAIR.exe`
		],
		[
			`air-runtime-${version}-mac`,
			`https://airsdk.harman.com/assets/downloads/${p}AdobeAIR.dmg`
		]
	];
}

async function main() {
	const args = process.argv.slice(2);
	if (args.length < 2) {
		throw new Error('Args: versioned version');
	}
	const [versioned, version] = args;

	const doc = [];
	const list = genList(version, !!+versioned);
	for (const [name, url] of list) {
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

		const [sha256, sha1, md5] =
			// eslint-disable-next-line no-await-in-loop
			await hashFile(cached.filepath, ['sha256', 'sha1', 'md5']);
		console.log(`SHA256: ${sha256}`);
		console.log(`SHA1: ${sha1}`);
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

	console.log('Done');
	console.log('-'.repeat(80));
	console.log(encodePackages(doc));
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
