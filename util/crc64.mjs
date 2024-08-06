/* eslint-disable no-bitwise */

import {Writable} from 'node:stream';

function createTable() {
	const table = [[], [], [], [], [], [], [], []];
	let crc;
	for (let i = 0; i < 256; i++) {
		crc = BigInt(i);
		for (let j = 0; j < 8; j++) {
			crc = crc & 1n ? 0xc96c5795d7870f42n ^ (crc >> 1n) : crc >> 1n;
		}
		table[0][i] = crc;
	}
	for (let i = 0; i < 256; i++) {
		crc = table[0][i];
		for (let j = 1; j < 8; j++) {
			table[j][i] = crc = table[0][Number(crc & 0xffn)] ^ (crc >> 8n);
		}
	}
	return table;
}

let TABLE;

export class Crc64 extends Writable {
	constructor() {
		super();

		TABLE = TABLE || createTable();
		this._state = 0xffffffffffffffffn;
		this._buffer = Buffer.alloc(0);
	}

	update(chunk, encoding) {
		let state = this._state;
		let b = Buffer.concat([this._buffer, Buffer.from(chunk, encoding)]);
		while (b.length > 8) {
			state ^=
				BigInt(b[0]) |
				(BigInt(b[1]) << 8n) |
				(BigInt(b[2]) << 16n) |
				(BigInt(b[3]) << 24n) |
				(BigInt(b[4]) << 32n) |
				(BigInt(b[5]) << 40n) |
				(BigInt(b[6]) << 48n) |
				(BigInt(b[7]) << 56n);
			state =
				TABLE[7][Number(state & 0xffn)] ^
				TABLE[6][Number((state >> 8n) & 0xffn)] ^
				TABLE[5][Number((state >> 16n) & 0xffn)] ^
				TABLE[4][Number((state >> 24n) & 0xffn)] ^
				TABLE[3][Number((state >> 32n) & 0xffn)] ^
				TABLE[2][Number((state >> 40n) & 0xffn)] ^
				TABLE[1][Number((state >> 48n) & 0xffn)] ^
				TABLE[0][Number(state >> 56n)];
			b = b.subarray(8);
		}
		this._buffer = Buffer.concat([b]);
		this._state = state;
	}

	digest(encoding = null) {
		let state = this._state;
		const b = this._buffer;
		const {length} = b;
		for (let i = 0; i < length; i++) {
			state = TABLE[0][Number(state & 0xffn) ^ b[i]] ^ (state >> 8n);
		}
		state = ~state & 0xffffffffffffffffn;
		this._state = null;
		this._buffer = null;
		const e = Buffer.alloc(8);
		e.writeBigUint64BE(state);
		return encoding ? e.toString(encoding) : e;
	}

	_write(chunk, encoding, callback) {
		this.update(chunk, encoding);
		callback();
	}
}
