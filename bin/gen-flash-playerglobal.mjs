#!/usr/bin/env node

/* eslint-disable no-console */

import {stat} from 'fs/promises';

import {ensure} from '../util/gencache.mjs';
import {file as hashFile} from '../util/hash.mjs';
import {packages as encodePackages} from '../util/yaml.mjs';

async function main() {
	const args = process.argv.slice(2);
	if (args.length < 1) {
		throw new Error('Missing version argument');
	}
	const [version] = args;

	const versionURL = version.replace(/\./, '_');
	const [versionMajor] = version.split('.');
	const name = `flash-playerglobal-${version}`;
	const url = `https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/playerglobal${versionURL}.swc`;

	console.log(`Name: ${name}`);
	console.log(`URL: ${url}`);

	// eslint-disable-next-line no-await-in-loop
	const cached = await ensure(name, url, progress => {
		const percent = progress * 100;
		process.stdout.write(`\rDownloading: ${percent.toFixed(2)}%\r`);
	});

	if (cached.downloaded) {
		console.log('');
	}
	else {
		console.log('Cached');
	}

	const {size} = await stat(cached.filepath);
	console.log(`Size: ${size}`);

	const [sha256, sha1, md5] =
		await hashFile(cached.filepath, ['sha256', 'sha1', 'md5']);
	console.log(`SHA256: ${sha256}`);
	console.log(`SHA1: ${sha1}`);
	console.log(`MD5: ${md5}`);
	console.log('');

	const doc = [{
		name,
		file: url.split('/').pop(),
		size,
		sha256,
		sha1,
		md5,
		source: url
	}];

	console.log('Done');
	console.log('-'.repeat(80));
	console.log(encodePackages(doc));
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
