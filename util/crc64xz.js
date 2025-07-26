import {Writable} from 'node:stream';

import CRC64 from '@hqtsm/crc/crc-64/xz';

export class Crc64xz extends Writable {
	constructor() {
		super();
		this._state = CRC64.init();
	}

	update(chunk, encoding) {
		const b = Buffer.from(chunk, encoding);
		this._state = CRC64.update(this._state, b);
	}

	digest(encoding = null) {
		const value = CRC64.finalize(this._state);
		this._state = null;
		const e = Buffer.alloc(8);
		e.writeBigUint64BE(value);
		return encoding ? e.toString(encoding) : e;
	}

	_write(chunk, encoding, callback) {
		this.update(chunk, encoding);
		callback();
	}
}
