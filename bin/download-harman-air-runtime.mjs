#!/usr/bin/env node

/* eslint-disable max-classes-per-file */

import {createReadStream} from 'node:fs';
import {mkdir, rename, stat, writeFile} from 'node:fs/promises';
import {dirname, join as pathJoin} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';

import {directory, read as packaged} from '../util/packages.mjs';
import {download} from '../util/download.mjs';
import {Hasher, Counter, Void} from '../util/stream.mjs';
import {queue} from '../util/queue.mjs';
import {
	createFileUrl,
	findGroup,
	groupFilesCaching,
	groupPath
} from '../util/ia.mjs';
import {Progress} from '../util/tui.mjs';
import {yyyymmdd} from '../util/util.mjs';
import {getUserAgent} from '../util/ff.mjs';
import {runtimes} from '../util/harman.mjs';
import {backup} from '../util/backup.mjs';

async function main() {
	// eslint-disable-next-line no-process-env
	const downloadThreads = +process.env.SHOCKPKG_DOWNLOAD_THREADS || 4;
	// eslint-disable-next-line no-process-env
	const backupThreads = +process.env.SHOCKPKG_BACKUP_THREADS || 4;

	const args = process.argv.slice(2);
	if (args.length < 1) {
		throw new Error('Args: outdir [backup]');
	}

	const [outdir, bkup] = args;

	const suf = yyyymmdd();
	const packages = await packaged();
	const userAgent = await getUserAgent();
	const resources = (await runtimes(userAgent)).map(info => ({
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
		const {name, source, file, mimetype, sha256: sha256e} = resource.info;
		const fileDir = pathJoin(outdir, name);
		const filePath = pathJoin(fileDir, file);
		const filePart = `${filePath}.part`;

		const hashSha256 = createHash('sha256');
		const hashSha1 = createHash('sha1');
		const hashMd5 = createHash('md5');
		const hasher = new Hasher([hashSha256, hashSha1, hashMd5]);

		let st = await stat(filePath).catch(() => null);
		let sha256 = null;
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
			await mkdir(fileDir, {recursive: true});
			await download(filePart, source, {
				headers: {
					...userAgent.headers
				},
				transforms: [hasher],
				response(response) {
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

			// Validate hash before move.
			sha256 = hashSha256.digest('hex');
			if (sha256 !== sha256e) {
				throw new Error(`Hash: ${sha256} != ${sha256e}: ${source}`);
			}

			st = await stat(filePart);
			await rename(filePart, filePath);
		}

		resource.file = filePath;

		resource.size = st.size;

		resource.hashes = {
			sha256: sha256 || hashSha256.digest('hex'),
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

	for (const {
		info,
		size,
		hashes: {sha256, sha1, md5},
		group
	} of resources) {
		const pkg = {
			name: info.name,
			file: info.file,
			size,
			sha256,
			sha1,
			md5,
			source: createFileUrl(group, groupPath(sha256, info.file))
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

	if (/^(1|true|yes)$/i.test(bkup)) {
		let failure = false;
		const metadata = groupFilesCaching();

		{
			console.log('-'.repeat(80));

			const groups = [...new Set(resources.map(r => r.group))].map(
				group => ({
					group,
					backup: ''
				})
			);

			const each = async group => {
				try {
					const m = await metadata(group);
					if (m.size) {
						group.backup = 'SKIP';
						return;
					}
				} catch (err) {
					group.backup = err.message;
					failure = true;
					return;
				}

				const path = `${group.group}.txt`;
				const file = `${outdir}/${path}`;
				await writeFile(file, group.group);
				const code = await backup(file, group.group, path, msg => {
					group.backup = msg;
				});
				group.backup = code ? `EXIT: ${code}` : 'DONE';
				if (code) {
					failure = true;
				}
			};

			const progress = new (class extends Progress {
				line(group) {
					return `${group.group}: ${group.backup}`;
				}
			})(groups, process.stdout);
			progress.start(1000);
			try {
				await queue(groups, each, backupThreads);
			} finally {
				progress.end();
			}
		}

		{
			console.log('-'.repeat(80));

			const each = async resource => {
				const {info, file, hashes, group} = resource;
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

				const code = await backup(file, group, path, msg => {
					resource.backup = msg;
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
