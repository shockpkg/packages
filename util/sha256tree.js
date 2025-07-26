import {createHash} from 'node:crypto';
import {Writable} from 'node:stream';

const BLOCK = 0x100000;

export class Sha256tree extends Writable {
	#hashes;

	#hashed;

	#hasher;

	constructor() {
		super();

		this.#hashes = [];
		this.#hashed = 0;
		this.#hasher = null;
	}

	update(chunk, encoding) {
		const hashes = this.#hashes;
		let hashed = this.#hashed;
		let hasher = this.#hasher;
		let block = BLOCK - hashed;
		let b = Buffer.from(chunk, encoding);
		while (b.length) {
			const d = b.subarray(0, block);
			hasher ??= createHash('sha256');
			hasher.update(d);
			if (d.length < block) {
				hashed += d.length;
				break;
			}
			hashes.push(hasher.digest());
			hasher = null;
			b = b.subarray(block);
			block = BLOCK;
			hashed = 0;
		}
		this.#hashed = hashed;
		this.#hasher = hasher;
	}

	digest(encoding = null) {
		let hashes = this.#hashes;
		if (!hashes) {
			throw new Error('Already digested');
		}
		this.#hashes = null;
		const hasher = this.#hasher;
		if (hasher) {
			hashes.push(hasher.digest());
			this.#hasher = null;
			this.#hashed = 0;
		}
		if (!hashes.length) {
			hashes.push(createHash('sha256').digest());
		}
		while (hashes.length > 1) {
			const paired = [];
			while (hashes.length) {
				const a = hashes.shift();
				if (!hashes.length) {
					paired.push(a);
					break;
				}
				const b = hashes.shift();
				const pair = createHash('sha256');
				pair.update(a);
				pair.update(b);
				paired.push(pair.digest());
			}
			hashes = paired;
		}
		return encoding ? hashes[0].toString(encoding) : hashes[0];
	}

	_write(chunk, encoding, callback) {
		this.update(chunk, encoding);
		callback();
	}
}
