import {createWriteStream} from 'fs';
import {mkdir, rename, stat} from 'fs/promises';
import {dirname, join as pathJoin} from 'path';
import {pipeline} from 'stream';
import {promisify} from 'util';
import {fileURLToPath} from 'url';

import fetch from 'node-fetch';

const __dirname = dirname(fileURLToPath(import.meta.url));

const pipe = promisify(pipeline);

const gencacheDir = pathJoin(__dirname, '..', '_gencache');
const tmpPre = '.tmp.';

const pathExists = path => stat(path).catch(() => null);

function urlFileName(url) {
	return decodeURIComponent(url.split(/[?#]/)[0].split('/').pop());
}

export function cacheTmp(name, url) {
	return pathJoin(gencacheDir, name, `${tmpPre}${urlFileName(url)}`);
}

export function cacheBin(name, url) {
	return pathJoin(gencacheDir, name, urlFileName(url));
}

export async function download(name, url, onprogress = null, headers = {}) {
	const fileCacheTmp = cacheTmp(name, url);
	const fileCacheBin = cacheBin(name, url);

	await Promise.all([...new Set([fileCacheTmp, fileCacheBin].map(
		p => mkdir(dirname(p), {recursive: true})
	))]);

	const fileCacheBinExists = await pathExists(fileCacheBin);
	if (!fileCacheBinExists) {
		let recievedLength = 0;

		const response = await fetch(url, {headers});
		if (response.status !== 200) {
			throw new Error(`Bad status code: ${response.status}`);
		}

		onprogress(0);
		const contentLength = +response.headers.get('content-length');
		const p = pipe(response.body, createWriteStream(fileCacheTmp));
		response.body.on('data', data => {
			recievedLength += data.length;
			onprogress(recievedLength / contentLength);
		});
		await p;

		if (recievedLength !== contentLength) {
			throw new Error(
				`Bad content length: ${recievedLength} != ${contentLength}`
			);
		}

		await rename(fileCacheTmp, fileCacheBin);
	}

	return {
		downloaded: !fileCacheBinExists,
		filepath: fileCacheBin
	};
}

export async function ensure(name, url, onprogress = null, headers = {}) {
	const fileCacheBin = cacheBin(name, url);

	let r = null;
	const fileCacheBinExists = await pathExists(fileCacheBin);
	if (fileCacheBinExists) {
		r = {
			downloaded: false,
			filepath: fileCacheBin
		};
	}
	else {
		r = await download(name, url, onprogress, headers);
	}
	return r;
}
