import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';

export async function file(fp, algos) {
	const hashers = algos.map(algo => createHash(algo));
	const f = createReadStream(fp);
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

export function buffer(data, algos) {
	return algos.map(algo => createHash(algo)
		.update(data)
		.digest('hex')
		.toLowerCase()
	);
}
