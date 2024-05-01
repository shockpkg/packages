import {createWriteStream} from 'node:fs';
import {rename} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

import {retry} from './util.mjs';

export async function download(output, url, headers = {}, progress = null) {
	const part = `${output}.part`;

	const response = await retry(() => fetch(url, {headers}));
	if (response.status !== 200) {
		throw new Error(`Status code: ${response.status}: ${url}`);
	}

	let size = 0;
	const total = +response.headers.get('content-length');
	if (progress) {
		progress({size, total});
	}

	const body = Readable.fromWeb(response.body);
	body.on('data', data => {
		size += data.length;
		if (progress) {
			progress({size, total});
		}
	});
	await pipeline(body, createWriteStream(part));

	if (size !== total) {
		throw new Error(`Unexpected size: ${size} != ${total}: ${url}`);
	}

	await rename(part, output);
}
