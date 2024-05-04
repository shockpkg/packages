/* eslint-disable max-classes-per-file */

import {Transform, Writable} from 'node:stream';

export class Void extends Writable {
	_write(chunk, encoding, callback) {
		callback();
	}
}

export class Counter extends Transform {
	constructor(progress) {
		super();

		this._progress = progress;
		this._total = 0;
	}

	_transform(chunk, encoding, callback) {
		this._total += Buffer.from(chunk, encoding).length;
		this._progress(this._total);
		this.push(chunk, encoding);
		callback();
	}
}

export class Hasher extends Transform {
	constructor(hashes) {
		super();

		this._hashes = hashes;
	}

	_transform(chunk, encoding, callback) {
		for (const hash of this._hashes) {
			hash.update(chunk, encoding);
		}
		this.push(chunk, encoding);
		callback();
	}
}
