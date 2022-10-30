'use strict';

const {mkdir, rename, stat} = require('fs/promises');
const {dirname, join: pathJoin} = require('path');

const {requestDownloadPromise} = require('./request');

const gencacheDir = pathJoin(__dirname, '..', '_gencache');
const tmpPre = '.tmp.';

const pathExists = path => stat(path).catch(() => null);

function urlFileName(url) {
	return url.split(/[?#]/)[0].split('/').pop();
}

function cacheTmp(name, url) {
	return pathJoin(gencacheDir, name, `${tmpPre}${urlFileName(url)}`);
}

function cacheBin(name, url) {
	return pathJoin(gencacheDir, name, urlFileName(url));
}

async function download(name, url, onprogress = null, headers = {}) {
	const fileCacheTmp = cacheTmp(name, url);
	const fileCacheBin = cacheBin(name, url);

	await Promise.all([...new Set([fileCacheTmp, fileCacheBin].map(
		p => mkdir(dirname(p), {recursive: true})
	))]);

	const fileCacheBinExists = await pathExists(fileCacheBin);
	if (!fileCacheBinExists) {
		let requestResponse = null;
		let contentLength = null;
		let recievedLength = 0;

		await requestDownloadPromise(
			{
				url,
				headers
			},
			fileCacheTmp,
			response => {
				requestResponse = response;
				contentLength = +response.headers['content-length'];
				onprogress(0);
			},
			data => {
				recievedLength += data.length;
				onprogress(recievedLength / contentLength);
			}
		);

		const {statusCode} = requestResponse;
		if (statusCode !== 200) {
			throw new Error(`Bad status code: ${statusCode}`);
		}

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

async function ensure(name, url, onprogress = null, headers = {}) {
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

exports.cacheTmp = cacheTmp;
exports.cacheBin = cacheBin;
exports.download = download;
exports.ensure = ensure;
