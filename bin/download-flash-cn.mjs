#!/usr/bin/env node

/* eslint-disable max-classes-per-file */

import {createReadStream} from 'node:fs';
import {mkdir, rename, stat, writeFile} from 'node:fs/promises';
import {dirname, join as pathJoin} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

import {directory, read as packaged} from '../util/packages.mjs';
import {walk, yyyymmdd} from '../util/util.mjs';
import {queue} from '../util/queue.mjs';
import {download} from '../util/download.mjs';
import {Hasher, Counter, Void} from '../util/stream.mjs';
import {Crc64xz} from '../util/crc64xz.mjs';
import {
	createFileUrl,
	groupFilesCaching,
	groupPath,
	findGroup
} from '../util/ia.mjs';
import {Progress} from '../util/tui.mjs';
import {getUserAgent} from '../util/ff.mjs';
import {downloads} from '../util/flashcn.mjs';

async function main() {
	// eslint-disable-next-line no-process-env
	const downloadThreads = +process.env.SHOCKPKG_DOWNLOAD_THREADS || 4;
	// eslint-disable-next-line no-process-env
	const backupThreads = +process.env.SHOCKPKG_BACKUP_THREADS || 1;

	const args = process.argv.slice(2);
	if (args.length < 1) {
		throw new Error('Args: outdir [backup]');
	}

	const [outdir, backup] = args;

	const suf = yyyymmdd();
	const packages = await packaged();
	const bySha256 = new Map(
		[...walk(packages, p => p.packages)].map(([p]) => [p.sha256, p])
	);

	const userAgent = await getUserAgent();
	const resources = (await downloads(userAgent)).map(info => ({
		info,
		progress: 0,
		size: null,
		hashes: null,
		file: null,
		backup: '',
		group:
			findGroup(info.group.join('-'), packages) ||
			[...info.group, suf].join('-')
	}));

	const each = async resource => {
		const {name, source, referer, file, mimetype} = resource.info;
		const fileDir = pathJoin(outdir, name);
		const filePath = pathJoin(fileDir, file);
		const filePart = `${filePath}.part`;

		const hashSha256 = createHash('sha256');
		const hashSha1 = createHash('sha1');
		const hashMd5 = createHash('md5');
		const hasher = new Hasher([hashSha256, hashSha1, hashMd5]);

		let st = await stat(filePath).catch(() => null);
		if (st) {
			const total = st.size;
			await pipeline(
				createReadStream(filePath),
				hasher,
				new Counter(size => {
					resource.progress = size / total;
				}),
				new Void()
			);
		} else {
			const hashCrc64xz = new Crc64xz();
			let crc64xz = null;
			await mkdir(fileDir, {recursive: true});
			await download(filePart, `${source}?_=${Date.now()}`, {
				headers: {
					...userAgent.headers,
					Referer: referer
				},
				transforms: [new Hasher([hashCrc64xz]), hasher],
				response(response) {
					// Wrong name, common mistake.
					crc64xz = response.headers.get('x-cos-hash-crc64ecma');
					const ct = response.headers.get('content-type');
					if (ct !== mimetype) {
						throw new Error(
							`Mimetype: ${ct} != ${mimetype}: ${source}`
						);
					}
				},
				progress({size, total}) {
					resource.progress = size / total;
				}
			});

			// Validate crc64 hash header.
			const crc64 = hashCrc64xz.digest().readBigUint64BE().toString();
			if (crc64 !== crc64xz) {
				throw new Error(`CRC64 header: ${crc64} !== ${crc64xz}`);
			}

			st = await stat(filePart);
			await rename(filePart, filePath);
		}

		resource.file = filePath;

		resource.size = st.size;

		resource.hashes = {
			sha256: hashSha256.digest('hex'),
			sha1: hashSha1.digest('hex'),
			md5: hashMd5.digest('hex')
		};
	};

	const progress = new (class extends Progress {
		line(resource) {
			const status = resource.hashes
				? 'DONE'
				: `%${(resource.progress * 100).toFixed(2)}`;
			return `${resource.info.name}: ${status}`;
		}
	})(resources, process.stdout);
	progress.start(1000);
	try {
		await queue(resources, each, downloadThreads);
	} finally {
		progress.end();
	}

	console.log('-'.repeat(80));

	const unchanged = resources.filter(r => bySha256.has(r.hashes.sha256));
	const changed = resources.filter(r => !bySha256.has(r.hashes.sha256));

	console.log(`UNCHANGED: ${unchanged.length}`);
	for (const r of unchanged) {
		console.log(r.info.name);
	}

	console.log('-'.repeat(80));

	console.log(`CHANGED: ${changed.length}`);
	for (const r of changed) {
		console.log(r.info.name);
	}

	console.log('-'.repeat(80));

	for (const {
		info,
		size,
		hashes: {sha256, sha1, md5},
		group
	} of changed) {
		const pkg = {
			name: info.name,
			file: info.file,
			size,
			sha256,
			sha1,
			md5,
			source: createFileUrl(group, groupPath(sha256, info.file)),
			metadata: {
				date: info.date
			}
		};
		const json = JSON.stringify(pkg, null, '\t');
		const f = pathJoin(...info.group, `${info.name}.json`);

		console.log(f);
		console.log(json);

		// eslint-disable-next-line no-await-in-loop
		await mkdir(dirname(pathJoin(directory, f)), {recursive: true});
		// eslint-disable-next-line no-await-in-loop
		await writeFile(pathJoin(directory, f), `${json}\n`);
	}

	if (/^(1|true|yes)$/i.test(backup)) {
		console.log('-'.repeat(80));

		let failure = false;
		const metadata = groupFilesCaching();

		const each = async resource => {
			const {info, file, hashes} = resource;
			const {group} = info;
			const path = groupPath(hashes.sha256, info.file);

			try {
				const m = await metadata(group);
				if (m.has(path)) {
					resource.backup = 'SKIP';
					return;
				}
			} catch (err) {
				resource.backup = err.message;
				failure = true;
				return;
			}

			const p = spawn('./bin/backup', ['backup.ini', file, group, path]);
			let stdout = '';
			p.stdout.on('data', data => {
				stdout += data.toString();
				stdout = stdout.slice(
					stdout.lastIndexOf('\n', stdout.length - 2) + 1
				);
				resource.backup = stdout.trim();
			});
			const code = await new Promise((resolve, reject) => {
				p.once('exit', resolve);
				p.once('error', reject);
			});
			resource.backup = code ? `EXIT: ${code}` : 'DONE';
			if (code) {
				failure = true;
			}
		};

		const progress = new (class extends Progress {
			line(resource) {
				return `${resource.info.name}: ${resource.backup}`;
			}
		})(resources, process.stdout);
		progress.start(1000);
		try {
			await queue(resources, each, backupThreads);
		} finally {
			progress.end();
		}

		if (failure) {
			process.exitCode = 1;
		}
	}
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
