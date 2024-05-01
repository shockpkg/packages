/* eslint-disable max-classes-per-file */

import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {Transform, Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export class HashWritable extends Writable {
	constructor(algos) {
		super();

		this._hashers = algos.map(algo => createHash(algo));
	}

	digests(encoding = null) {
		if (encoding) {
			return this._hashers.map(hasher => hasher.digest(encoding));
		}
		return this._hashers.map(hasher => hasher.digest());
	}

	_write(chunk, encoding, callback) {
		for (const hasher of this._hashers) {
			hasher.update(chunk, encoding);
		}
		callback();
	}
}

export class HashTransform extends Transform {
	constructor(algos) {
		super();

		this._hashers = algos.map(algo => createHash(algo));
	}

	digests(encoding = null) {
		if (encoding) {
			return this._hashers.map(hasher => hasher.digest(encoding));
		}
		return this._hashers.map(hasher => hasher.digest());
	}

	_transform(chunk, encoding, callback) {
		for (const hasher of this._hashers) {
			hasher.update(chunk, encoding);
		}
		this.push(chunk, encoding);
		callback();
	}
}

export async function stream(stream, algos, enc = null) {
	const h = new HashWritable(algos);
	await pipeline(stream, h);
	return h.digests(enc);
}

export async function file(fp, algos, enc = null) {
	const f = createReadStream(fp);
	let r;
	try {
		r = await stream(f, algos, enc);
	}
	finally {
		f.close();
	}
	return r;
}
