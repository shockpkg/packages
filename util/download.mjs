import {createWriteStream} from 'node:fs';
import {rename} from 'node:fs/promises';
import {Readable, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

import {retry} from './util.mjs';

export async function download(output, url, opts = {}) {
	const part = `${output}.part`;

	const response = await retry(() =>
		fetch(url, {headers: opts.headers || {}})
	);
	if (response.status !== 200) {
		throw new Error(`Status code: ${response.status}: ${url}`);
	}

	let size = 0;
	const total = +response.headers.get('content-length');

	if (opts.progress) {
		opts.progress({size, total});
	}

	await pipeline(
		Readable.fromWeb(response.body),
		new (class extends Transform {
			_transform(chunk, encoding, callback) {
				size += Buffer.from(chunk, encoding).length;
				this.push(chunk, encoding);
				if (opts.progress) {
					opts.progress({size, total});
				}
				callback();
			}
		})(),
		createWriteStream(part)
	);

	if (size !== total) {
		throw new Error(`Unexpected size: ${size} != ${total}: ${url}`);
	}

	await rename(part, output);
}
