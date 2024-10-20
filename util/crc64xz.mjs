/* eslint-disable no-bitwise */

import {Writable} from 'node:stream';

function createTable() {
	const table = new BigUint64Array(256);
	let crc;
	for (let i = 0n; i < 256n; i++) {
		crc = i;
		for (let j = 0; j < 8; j++) {
			crc = crc & 1n ? 0xc96c5795d7870f42n ^ (crc >> 1n) : crc >> 1n;
		}
		table[i] = crc;
	}
	return table;
}

let TABLE;

export class Crc64xz extends Writable {
	constructor() {
		super();

		TABLE = TABLE || createTable();
		this._state = 0xffffffffffffffffn;
	}

	update(chunk, encoding) {
		let state = this._state;
		const b = Buffer.from(chunk, encoding);
		const {length} = b;
		for (let i = 0; i < length; i++) {
			state = TABLE[Number(state & 0xffn) ^ b[i]] ^ (state >> 8n);
		}
		this._state = state;
	}

	digest(encoding = null) {
		let state = this._state;
		state = state ^ 0xffffffffffffffffn;
		this._state = null;
		const e = Buffer.alloc(8);
		e.writeBigUint64BE(state);
		return encoding ? e.toString(encoding) : e;
	}

	_write(chunk, encoding, callback) {
		this.update(chunk, encoding);
		callback();
	}
}
