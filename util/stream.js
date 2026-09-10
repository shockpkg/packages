import {Transform, Writable} from 'node:stream';

export class Void extends Writable {
	// eslint-disable-next-line unicorn/prefer-private-class-fields
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

	// eslint-disable-next-line unicorn/prefer-private-class-fields
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

	// eslint-disable-next-line unicorn/prefer-private-class-fields
	_transform(chunk, encoding, callback) {
		for (const hash of this._hashes) {
			hash.update(chunk, encoding);
		}
		this.push(chunk, encoding);
		callback();
	}
}
