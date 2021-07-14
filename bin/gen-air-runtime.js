#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const path = require('path');

const fse = require('fs-extra');

const gencache = require('../util/gencache');
const hash = require('../util/hash');
const zip = require('../util/zip');
const paths = require('../util/paths');
const yaml = require('../util/yaml');

const packagesDir = path.join(path.dirname(__dirname), 'packages');

function pathToName(filepath) {
	return filepath.split('/').pop();
}

function genList(version) {
	const verstr = version
		.split('.')
		.slice(0, 2)
		.join('.');

	return [
		[
			`air-runtime-${version}-windows-archive`,
			`https://fpdownload.macromedia.com/air/win/download/${verstr}/AdobeAIRInstaller.zip`
		],
		[
			`air-runtime-${version}-mac`,
			`https://fpdownload.macromedia.com/air/mac/download/${verstr}/AdobeAIR.dmg`
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

		const archiveSuffix = '-archive';
		if (name.endsWith(archiveSuffix)) {
			const nameSub = name.substr(0, name.length - archiveSuffix.length);

			let pkg = null;

			// eslint-disable-next-line no-await-in-loop
			await zip.itterFile(cached.filepath, async info => {
				if (info.isDirector) {
					return;
				}
				const {filepath} = info;
				if (paths.isSystem(filepath) || paths.isMetadata(filepath)) {
					return;
				}
				if (pkg) {
					throw new Error(`Unexpected second entry ${filepath}`);
				}

				const filename = pathToName(filepath);

				console.log(`  Filepath: ${filepath}`);

				const data = await info.read();
				const size = data.length;
				console.log(`  Size: ${size}`);

				const [sha256, sha1, md5] =
					await hash.buffer(data, ['sha256', 'sha1', 'md5']);
				console.log(`  SHA256: ${sha256}`);
				console.log(`  SHA1: ${sha1}`);
				console.log(`  MD5: ${md5}`);

				console.log(`  Name: ${nameSub}`);

				pkg = {
					name: nameSub,
					file: filename,
					size,
					sha256,
					sha1,
					md5,
					source: filepath
				};
			});

			entry.packages = [pkg];
		}

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
