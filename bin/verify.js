#!/usr/bin/env node

import {read as packaged} from '../util/packages.js';
import {groupURL, parsePackageUrl, groupFiles} from '../util/ia.js';
import {retry} from '../util/util.js';

class URLValidator {
	constructor(pkg) {
		this.pkg = pkg;
	}

	get name() {
		return this.pkg.name;
	}

	get source() {
		return this.pkg.source;
	}

	async status() {
		const {size, source} = this.pkg;
		const response = await retry(() =>
			fetch(source, {
				method: 'HEAD'
			})
		);
		const {status, headers} = response;
		if (status !== 200) {
			throw new Error(`Status code: ${status}: ${source}`);
		}
		const cl = +headers.get('content-length');
		if (cl !== size) {
			throw new Error(
				`Invalid content-length: ${cl} != ${size}: ${source}`
			);
		}
		return [[this.pkg, []]];
	}

	failed(reason) {
		return [this.pkg, [reason]];
	}
}

class IAValidator {
	constructor(item) {
		this.item = item;
		this.list = [];
	}

	get name() {
		return this.item;
	}

	get source() {
		return groupURL(this.item);
	}

	async status() {
		const files = await groupFiles(this.item);
		return this.list.map(pkg => {
			const errors = [];
			const file = files.get(pkg.sha256);
			if (file) {
				if (file.size !== pkg.size) {
					errors.push(`Size: ${file.size} != ${pkg.size}`);
				}
				if (file.md5 !== pkg.md5) {
					errors.push(`MD5: ${file.md5} != ${pkg.md5}`);
				}
				if (file.sha1 !== pkg.sha1) {
					errors.push(`SHA1: ${file.sha1} != ${pkg.sha1}`);
				}
				if (file.private) {
					errors.push('Private');
				}
			} else {
				errors.push('Missing');
			}
			return [pkg, errors];
		});
	}

	failed(reason) {
		return this.list.map(pkg => [pkg, [reason]]);
	}
}

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = +process.env.SHOCKPKG_NEWEST_THREADS || 6;
	// eslint-disable-next-line no-process-env
	const includes = process.env.SHOCKPKG_VERIFY_INCLUDES || '';

	console.log(`Threads: ${threads}`);

	const packages = await packaged();
	let resources = packages;

	if (includes) {
		const str = JSON.stringify(includes);
		console.log(`Only checking those names including: ${str}`);
		resources = packages.filter(pkg => pkg.name.includes(includes));
	}

	const q = (() => {
		const buckets = new Map();
		for (const pkg of resources) {
			const ia = parsePackageUrl(pkg.source);
			if (ia) {
				const key = `ia:${ia.item}`;
				const validator = buckets.get(key) || new IAValidator(ia.item);
				validator.list.push(pkg);
				buckets.set(key, validator);
			} else {
				buckets.set(pkg.source, new URLValidator(pkg));
			}
		}
		return [...buckets.values()];
	})();

	const retrys = new Set();
	const passed = [];
	const failed = [];
	await Promise.all(
		Array.from({length: threads})
			.fill(0)
			.map(async () => {
				while (q.length) {
					const validator = q.shift();
					const {name} = validator;

					console.log(`${name}: ${validator.source}: Checking`);

					let status;
					try {
						// eslint-disable-next-line no-await-in-loop
						status = await validator.status();
					} catch (err) {
						const {message} = err;
						if (!retrys.has(validator)) {
							retrys.add(validator);
							console.log(`${name}: Retry: ${message}`);
							q.push(validator);
							continue;
						}

						console.log(`${name}: Fail: ${message}`);
						for (const [pkg, errors] of validator.failed(message)) {
							console.log(`${pkg.name}: Fail: ${errors[0]}`);
							failed.push([pkg, errors]);
						}
						continue;
					}

					for (const [pkg, errors] of status) {
						if (errors.length) {
							failed.push([pkg, errors]);
							console.log(`${pkg.name}: Fail: ${errors[0]}`);
						} else {
							passed.push(pkg);
							console.log(`${pkg.name}: Pass`);
						}
					}
				}
			})
	);

	console.log(`Passed: ${passed.length}`);
	console.log(`Failed: ${failed.length}`);

	for (const [pkg, errors] of failed) {
		console.log(`${pkg.name}: ${pkg.source}: ${errors[0]}`);
	}

	if (failed.length) {
		process.exitCode = 1;
	}
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
