import {retry} from './util.js';

const regSha256 = /^[\da-f]{64}$/i;

export function groupPath(sha256, file) {
	return `${sha256}/${file}`;
}

export function createFileUrl(group, file) {
	const f = file.split('/').map(encodeURIComponent).join('/');
	const b = encodeURIComponent(group);
	return `https://archive.org/download/${b}/${f}`;
}

export function parsePackageUrl(url) {
	const u = new URL(url);
	if (u.host !== 'archive.org') {
		return null;
	}
	const path = u.pathname.split('/');
	if (path.shift() !== '') {
		return null;
	}
	if (path.shift() !== 'download') {
		return null;
	}
	const item = path.shift();
	const file = decodeURIComponent(path.pop());
	const sha256 = path.join('');
	return regSha256.test(sha256) ? {item, sha256, file} : null;
}

export async function groupFiles(group) {
	const url = `https://archive.org/metadata/${group}/`;
	const files = await retry(() =>
		retry(() => fetch(url)).then(async response => {
			const {status} = response;
			if (status !== 200) {
				throw new Error(`Status code: ${status}: ${url}`);
			}
			const body = await response.text();
			const files = new Map();
			const json = JSON.parse(body);
			if (!Object.keys(json).length) {
				return files;
			}
			if (!json || !Array.isArray(json.files)) {
				throw new Error(
					`Invalid json: ${url}: ${JSON.stringify(json)}`
				);
			}
			for (const file of json.files) {
				const info = {
					file: file.name,
					size: +file.size,
					md5: file.md5,
					sha1: file.sha1
				};

				const sha256 = file.name.split('/').slice(0, -1).join('');
				if (!regSha256.test(sha256)) {
					continue;
				}

				if (file.private) {
					info.private = true;
				}

				files.set(sha256, info);
			}
			return files;
		})
	);
	return files;
}

export function groupFilesCaching() {
	const cache = {};
	return async group => (cache[group] = cache[group] || groupFiles(group));
}

export function findGroup(prefix, packages) {
	const matches = new Map();
	let most = 0;
	const pre = `${prefix}-`;
	for (const p of packages) {
		const parsed = parsePackageUrl(p.source);
		if (parsed && parsed.item.startsWith(pre)) {
			const total = (matches.get(parsed.item) || 0) + 1;
			if (total > most) {
				most = total;
			}
			matches.set(parsed.item, total);
		}
	}
	for (const [item, total] of matches) {
		if (total === most) {
			return item;
		}
	}
	return null;
}
