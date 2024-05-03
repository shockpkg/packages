import {createWriteStream} from 'node:fs';
import {rename} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

import {retry} from './util.mjs';
import {Progress} from './stream.mjs';

export async function download(output, url, opts = {}) {
	const part = `${output}.part`;

	const response = await retry(() =>
		fetch(url, {headers: opts.headers || {}})
	);
	if (opts.response) {
		opts.response(response);
	}
	if (response.status !== 200) {
		throw new Error(`Status code: ${response.status}: ${url}`);
	}

	const total = +response.headers.get('content-length');

	if (opts.progress) {
		opts.progress({size: 0, total});
	}

	let sized = 0;
	await pipeline(
		Readable.fromWeb(response.body),
		new Progress(size => {
			sized = size;
			if (opts.progress) {
				opts.progress({size, total});
			}
		}),
		createWriteStream(part)
	);

	if (sized !== total) {
		throw new Error(`Unexpected size: ${sized} != ${total}: ${url}`);
	}

	await rename(part, output);
}
