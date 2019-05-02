#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const asyncQueue = require('async/queue');

const packages = require('../util/packages');
const {requestPromise} = require('../util/request');

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

	const report = await new Promise((resolve, reject) => {
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

			const {response} = await requestPromise({
				method: 'HEAD',
				url: task.pkg.source,
				followRedirect: false
			});

			const {statusCode} = response;
			if (statusCode !== 200) {
				throw new Error(`Unexpected status code: ${statusCode}`);
			}

			const contentLength = +response.headers['content-length'];
			if (contentLength !== task.pkg.size) {
				throw new Error(
					`Unexpected content-length: ${contentLength}` +
					` (expected ${task.pkg.size})`
				);
			}

			taskEnd(task, null);
			reporter(task, null);
		}, threads);

		q.error = (err, task) => {
			taskEnd(task, err);

			if (task.attempt < task.retries) {
				console.log(`${task.pkg.name}: Retrying [${retryStat(task)}]`);
				q.push(task);
			}
			else {
				reporter(task, err);
			}
		};

		q.drain = () => {
			resolve(report);
		};

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
