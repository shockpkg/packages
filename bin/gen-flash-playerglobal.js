#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const path = require('path');

const fse = require('fs-extra');

const gencache = require('../util/gencache');
const hash = require('../util/hash');
const yaml = require('../util/yaml');

const packagesDir = path.join(__dirname, '..', 'packages');

async function main() {
	const args = process.argv.slice(2);
	if (args.length < 1) {
		throw new Error('Missing version argument');
	}
	const [version] = args;

	const file = path.join(
		packagesDir,
		'flash-playerglobal',
		`${version}.yaml`
	);
	const fileExists = await fse.pathExists(file);
	if (fileExists) {
		throw new Error(`Path exists: ${file}`);
	}

	const versionURL = version.replace(/\./, '_');
	const name = `flash-playerglobal-${version}`;
	const url = `https://fpdownload.macromedia.com/get/flashplayer/installers/archive/playerglobal/playerglobal${versionURL}.swc`;

	console.log(`Name: ${name}`);
	console.log(`URL: ${url}`);

	// eslint-disable-next-line no-await-in-loop
	const cached = await gencache.ensure(name, url, progress => {
		const percent = progress * 100;
		process.stdout.write(`\rDownloading: ${percent.toFixed(2)}%`);
	});

	if (cached.downloaded) {
		console.log('');
	}
	else {
		console.log('Cached');
	}

	const stat = await fse.stat(cached.filepath);
	const {size} = stat;
	console.log(`Size: ${size}`);

	const sha256 = await hash.file(cached.filepath, 'sha256');
	console.log(`SHA256: ${sha256}`);
	console.log('');

	const doc = [{
		name,
		file: url.split('/').pop(),
		size,
		sha256,
		source: url
	}];

	console.log(`Writing: ${file}`);

	const data = yaml.packages(doc);
	await fse.writeFile(file, data, 'utf8');

	console.log('Done');
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
