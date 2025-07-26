#!/usr/bin/env node

import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';

import {Crc64xz} from '../util/crc64xz.js';
import {Sha256tree} from '../util/sha256tree.js';
import {Hasher, Void} from '../util/stream.js';

async function main() {
	const args = process.argv.slice(2);
	const files = args.length < 1 ? ['-'] : args;
	for (const file of files) {
		const crc64xz = new Crc64xz();
		const md5 = createHash('md5');
		const sha1 = createHash('sha1');
		const sha256 = createHash('sha256');
		const sha256tree = new Sha256tree();
		const hashes = [crc64xz, md5, sha1, sha256, sha256tree];
		const hasher = new Hasher(hashes);
		const src = file === '-' ? process.stdin : createReadStream(file);
		// eslint-disable-next-line no-await-in-loop
		await pipeline(src, hasher, new Void());
		console.log([...hashes.map(h => h.digest('hex')), file].join(' '));
	}
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
