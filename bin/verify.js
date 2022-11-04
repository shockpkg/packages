#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const asyncQueue = require('async/queue');
const fetch = require('node-fetch');

const packages = require('../util/packages');

function archiveOrgParse(url) {
	const u = new URL(url);
	if (u.host !== 'archive.org') {
		return null;
	}
	const path = u.pathname.split('/');
	if (path.shift() !== '' || path.shift() !== 'download') {
		return null;
	}
	const item = path.shift();
	return {
		item,
		path: decodeURI(path.join('/'))
	};
}

const archiveOrgMetadataCache = {};
function archiveOrgMetadata(item) {
	if (!archiveOrgMetadataCache[item]) {
		archiveOrgMetadataCache[item] = fetch(
			`https://archive.org/metadata/${encodeURI(item)}/`
		).then(async response => {
			const {status} = response;
			if (status !== 200) {
				throw new Error(`Unexpected status code: ${status}`);
			}
			const body = await response.text();
			const files = new Map();
			for (const file of JSON.parse(body).files) {
				const info = {
					size: +file.size,
					md5: file.md5,
					sha1: file.sha1
				};

				const parts = file.name.split('/');
				parts.pop();
				const maybeSha256 = parts.join('');
				if (maybeSha256.length === 64) {
					info.sha256 = maybeSha256;
				}

				if (file.private) {
					info.private = true;
				}

				files.set(file.name, info);
			}
			return files;
		});
	}
	return archiveOrgMetadataCache[item];
}

async function getMetadataForUrl(url) {
	const archiveOrg = archiveOrgParse(url);
	if (archiveOrg) {
		const metadata = await archiveOrgMetadata(archiveOrg.item);
		const info = metadata.get(archiveOrg.path);
		if (!info) {
			throw new Error(`Unknown item entry: ${url}`);
		}
		return info;
	}

	const response = await fetch(url);
	const {status} = response;
	if (status !== 200) {
		throw new Error(`Unexpected status code: ${status}`);
	}
	return {
		size: +response.headers.get('content-length')
	};
}

async function main() {
	const start = Date.now();

	const pkgs = packages.packages;
	let included = null;

	// eslint-disable-next-line no-process-env
	const threads = (+process.env.SHOCKPKG_VERIFY_THREADS) || 4;
	console.log(`Number of threads: ${threads}`);

	// eslint-disable-next-line no-process-env
	const retries = (+process.env.SHOCKPKG_VERIFY_RETRY) || 4;
	console.log(`Number of retries: ${retries}`);

	// eslint-disable-next-line no-process-env
	const delay = (+process.env.SHOCKPKG_VERIFY_RETRY_DELAY) || 0;
	console.log(`Delay before retry in milliseconds: ${delay}`);

	// eslint-disable-next-line no-process-env
	const includes = process.env.SHOCKPKG_VERIFY_INCLUDES || null;
	if (includes) {
		const str = JSON.stringify(includes);
		console.log(`Only checking those names including ${str}`);
		included = pkgs.filter(pkg => pkg.name.includes(includes));
	}
	else {
		included = pkgs;
	}

	console.log(`Checking ${included.length} of ${pkgs.length}`);
	console.log('');

	const retryStat = task => `${task.attempt}/${task.retries}`;

	const taskReport = (task, err) => {
		const ms = task.end - task.start;
		const state = (err ? 'Error' : 'Done');
		const info = err ? `: ${err.message}` : '';
		const retry = `[${retryStat(task)}]`;

		console.log(`${task.pkg.name}: ${state} ${retry} (${ms}ms)${info}`);
	};

	const report = await new Promise(resolve => {
		const report = [];
		const reporter = (task, err) => {
			report.push({task, err});
		};

		const taskEnd = (task, err) => {
			task.end = Date.now();
			taskReport(task, err);
		};

		const q = asyncQueue(async task => {
			task.start = Date.now();
			task.attempt++;

			console.log(`${task.pkg.name}: Checking [${retryStat(task)}]`);
			const metadata = await getMetadataForUrl(task.pkg.source);

			if (metadata.size !== task.pkg.size) {
				throw new Error(
					`Unexpected size: ${metadata.size}` +
					` (expected ${task.pkg.size})`
				);
			}

			for (const algo of ['md5', 'sha1', 'sha256']) {
				if (!metadata[algo]) {
					continue;
				}
				if (metadata[algo] === task.pkg[algo]) {
					continue;
				}
				throw new Error(
					`Unexpected ${algo}: ${metadata[algo]}` +
					` (expected ${task.pkg[algo]})`
				);
			}

			if (metadata.private) {
				throw new Error('Unexpected private');
			}

			taskEnd(task, null);
			reporter(task, null);
		}, threads);

		let pending = 0;

		q.error((err, task) => {
			taskEnd(task, err);

			if (task.attempt < task.retries) {
				const after = delay ? ` after ${delay}ms` : '';
				console.log(
					`${task.pkg.name}: Retrying [${retryStat(task)}]${after}`
				);

				if (delay) {
					pending++;
					setTimeout(() => {
						q.push(task);
						pending--;
					}, delay);
				}
				else {
					q.push(task);
				}
			}
			else {
				reporter(task, err);
			}
		});

		q.drain(() => {
			if (!pending) {
				resolve(report);
			}
		});

		for (const pkg of included) {
			q.push({pkg, start: null, end: null, attempt: 0, retries});
		}
	});
	console.log('');

	const reportPassed = report.filter(entry => !entry.err);
	const reportFailed = report.filter(entry => entry.err);

	if (reportFailed.length) {
		console.log(`Failed: ${reportFailed.length}`);
		for (const {task, err} of reportFailed) {
			if (err) {
				taskReport(task, err);
			}
		}
		console.log('');
	}

	const end = Date.now();
	console.log(`Passed: ${reportPassed.length}`);
	console.log(`Failed: ${reportFailed.length}`);
	console.log(`Done after ${end - start}ms`);
	console.log('');

	if (reportFailed.length) {
		process.exitCode = 1;
	}
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
