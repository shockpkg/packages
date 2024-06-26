import {createWriteStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

import {retry} from './util.mjs';
import {Counter} from './stream.mjs';

export async function download(output, url, opts = {}) {
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
		new Counter(size => {
			sized = size;
			if (opts.progress) {
				opts.progress({size, total});
			}
		}),
		...(opts.transforms || []),
		createWriteStream(output)
	);

	if (sized !== total) {
		throw new Error(`Unexpected size: ${sized} != ${total}: ${url}`);
	}
}
