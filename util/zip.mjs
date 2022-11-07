import {promisify} from 'util';

import yauzl from 'yauzl';
import crc32 from 'buffer-crc32';

const yauzlOpen = promisify(yauzl.open.bind(yauzl));

async function readEntry(zipfile, entry, verify) {
	const data = await new Promise((resolve, reject) => {
		zipfile.openReadStream(entry, (err, readStream) => {
			if (err) {
				reject(err);
				return;
			}

			const chunks = [];
			readStream.on('data', data => {
				chunks.push(data);
			});
			readStream.on('end', () => {
				resolve(Buffer.concat(chunks));
			});
			readStream.on('error', err => {
				reject(err);
			});
		});
	});

	if (verify) {
		const expected = entry.crc32;
		const actual = crc32.unsigned(data);
		if (expected !== actual) {
			throw new Error(
				`Invalid CRC32: Expected ${expected}, got ${actual}`
			);
		}
	}

	if (verify) {
		const expected = entry.uncompressedSize;
		const actual = data.length;
		if (expected !== actual) {
			throw new Error(
				`Invalid size: Expected ${expected}, got ${actual}`
			);
		}
	}
	return data;
}

async function itterZipfile(zipfile, itter) {
	await new Promise((resolve, reject) => {
		let error = null;
		const next = err => {
			if (err) {
				error = err;
				zipfile.close();
				return;
			}
			zipfile.readEntry();
		};
		zipfile.on('error', next);
		zipfile.on('entry', async entry => {
			const read = async (verify = true) => {
				const r = await readEntry(zipfile, entry, verify);
				return r;
			};
			const filepath = entry.fileName.replace(/\\/g, '/');
			const isDirector = filepath.endsWith('/');
			try {
				await itter({
					zipfile,
					entry,
					filepath,
					isDirector,
					read
				});
			}
			catch (err) {
				next(err);
				return;
			}
			next();
		});
		zipfile.on('close', () => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
		next();
	});
}

export async function itterFile(filepath, itter) {
	const zipfile = await yauzlOpen(filepath, {lazyEntries: true});
	await itterZipfile(zipfile, itter);
}
