#!/usr/bin/env node

/* eslint-disable no-console */

import {stat} from 'fs/promises';

import {ensure} from '../util/gencache.mjs';
import {file as hashFile, buffer as hashBuffer} from '../util/hash.mjs';
import {itterFile as zipItterFile} from '../util/zip.mjs';
import {isSystem, isMetadata} from '../util/paths.mjs';
import {packages as encodePackages} from '../util/yaml.mjs';

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

		const archiveSuffix = '-archive';
		if (name.endsWith(archiveSuffix)) {
			const nameSub = name.substr(0, name.length - archiveSuffix.length);

			let pkg = null;

			// eslint-disable-next-line no-await-in-loop
			await zipItterFile(cached.filepath, async info => {
				if (info.isDirector) {
					return;
				}
				const {filepath} = info;
				if (isSystem(filepath) || isMetadata(filepath)) {
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
					await hashBuffer(data, ['sha256', 'sha1', 'md5']);
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

	console.log('Done');
	console.log('-'.repeat(80));
	console.log(encodePackages(doc));
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
