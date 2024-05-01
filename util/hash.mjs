import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

class NullStream extends Writable {
	_write(_chunk, _enc, next) {
		next();
	}
}

export async function stream(stream, algos) {
	const hashers = algos.map(algo => createHash(algo));
	stream.on('data', data => {
		for (const hasher of hashers) {
			hasher.update(data);
		}
	});
	await pipeline(stream, new NullStream());
	return hashers.map(hasher => hasher.digest('hex').toLowerCase());
}

export async function file(fp, algos) {
	const f = createReadStream(fp);
	let r;
	try {
		r = await stream(f, algos);
	}
	finally {
		f.close();
	}
	return r;
}
