'use strict';

const path = require('path');

const fse = require('fs-extra');

const {requestDownloadPromise} = require('./request');

const gencacheDir = path.join(__dirname, '..', '_gencache');

function cacheTmp(name) {
	return path.join(gencacheDir, `${name}.tmp`);
}

function cacheBin(name) {
	return path.join(gencacheDir, `${name}.bin`);
}

async function download(name, url, onprogress = null) {
	await fse.ensureDir(gencacheDir);

	const fileCacheTmp = cacheTmp(name);
	const fileCacheBin = cacheBin(name);

	const fileCacheBinExists = await fse.pathExists(fileCacheBin);
	if (!fileCacheBinExists) {
		let requestResponse = null;
		let contentLength = null;
		let recievedLength = 0;

		// eslint-disable-next-line no-await-in-loop
		await requestDownloadPromise(
			{
				url
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

		// eslint-disable-next-line no-await-in-loop
		await fse.move(fileCacheTmp, fileCacheBin);
	}

	return {
		downloaded: !fileCacheBinExists,
		filepath: fileCacheBin
	};
}

async function ensure(name, url, onprogress = null) {
	await fse.ensureDir(gencacheDir);

	const fileCacheBin = cacheBin(name);

	let r = null;
	const fileCacheBinExists = await fse.pathExists(fileCacheBin);
	if (fileCacheBinExists) {
		r = {
			downloaded: false,
			filepath: fileCacheBin
		};
	}
	else {
		r = await download(name, url, onprogress);
	}
	return r;
}

exports.cacheTmp = cacheTmp;
exports.cacheBin = cacheBin;
exports.download = download;
exports.ensure = ensure;
