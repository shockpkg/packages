'use strict';

const fs = require('fs');
const stream = require('stream');
const crypto = require('crypto');

async function file(fp, algo) {
	const r = await new Promise((resolve, reject) => {
		const hash = crypto.createHash(algo).setEncoding('hex');
		const fin = fs.createReadStream(fp);
		stream.pipeline(fin, hash, err => {
			if (err) {
				reject(err);
				return;
			}
			resolve(hash.read().toLowerCase());
		});
	});
	return r;
}

exports.file = file;
