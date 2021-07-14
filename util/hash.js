'use strict';

const fs = require('fs');
const crypto = require('crypto');

async function file(fp, algos) {
	const hashers = algos.map(algo => crypto.createHash(algo));
	const f = fs.createReadStream(fp);
	f.on('data', data => {
		for (const hasher of hashers) {
			hasher.update(data);
		}
	});
	await new Promise((resolve, reject) => {
		f.on('end', () => {
			f.close();
			resolve();
		});
		f.on('error', err => {
			f.close();
			reject(err);
		});
	});
	return hashers.map(hasher => hasher.digest('hex').toLowerCase());
}

function buffer(data, algos) {
	return algos.map(algo => crypto
		.createHash(algo)
		.update(data)
		.digest('hex')
		.toLowerCase()
	);
}

exports.file = file;
exports.buffer = buffer;
