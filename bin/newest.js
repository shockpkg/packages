#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const asyncQueue = require('async/queue');

const {requestPromise} = require('../util/request');

// Used to check for Shockwave Player updates, but downloads are all down.
const resources = [
	// {
	// 	source: 'https://fpdownload.macromedia.com/get/shockwave/cabs/director/sw.cab',
	// 	size: 1292210,
	// 	lastModified: 'Tue, 26 Mar 2019 04:34:58 GMT',
	// 	eTag: '"13b7b2-584f7d7ef82db"'
	// },
	// {
	// 	source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/Shockwave_Installer_Full.exe',
	// 	size: 15124440,
	// 	lastModified: 'Tue, 26 Mar 2019 04:34:55 GMT',
	// 	eTag: '"e6c7d8-584f7d7c2de38"'
	// },
	// {
	// 	source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/sw_lic_full_installer.exe',
	// 	size: 13126832,
	// 	lastModified: 'Tue, 26 Mar 2019 04:34:56 GMT',
	// 	eTag: '"c84cb0-584f7d7d11014"'
	// },
	// {
	// 	source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/sw_lic_full_installer.msi',
	// 	size: 24256512,
	// 	lastModified: 'Tue, 26 Mar 2019 04:35:03 GMT',
	// 	eTag: '"1722000-584f7d83b17b1"'
	// },
	// {
	// 	source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/Shockwave_Installer_Slim.exe',
	// 	size: 6257824,
	// 	lastModified: 'Tue, 26 Mar 2019 04:34:53 GMT',
	// 	eTag: '"5f7ca0-584f7d7abb4d3"'
	// },
	// {
	// 	source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/sw_lic_slim_installer.exe',
	// 	size: 4262176,
	// 	lastModified: 'Tue, 26 Mar 2019 04:34:54 GMT',
	// 	eTag: '"410920-584f7d7bb709f"'
	// },
	// {
	// 	source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/macosx/latest/Shockwave_Installer_Full_64bit.dmg',
	// 	size: 18771823,
	// 	lastModified: 'Thu, 29 Sep 2016 10:27:21 GMT',
	// 	eTag: '"11e6f6f-53da2ec48cdf6"'
	// },
	// {
	// 	source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/macosx/latest/Shockwave_Installer_Full.dmg',
	// 	size: 22513907,
	// 	lastModified: 'Thu, 04 Oct 2012 18:22:08 GMT',
	// 	eTag: '"15788f3-4cb3fd5409400"'
	// },
	// {
	// 	source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/macosx/latest/Shockwave_Installer_Slim.dmg',
	// 	size: 3888494,
	// 	lastModified: 'Thu, 04 Oct 2012 18:22:26 GMT',
	// 	eTag: '"3b556e-4cb3fd6533c80"'
	// }
];

const headerMappings = [
	['size', 'content-length'],
	['lastModified', 'last-modified'],
	['eTag', 'etag']
];

async function main() {
	const start = Date.now();

	// eslint-disable-next-line no-process-env
	const threads = (+process.env.SHOCKPKG_NEWEST_THREADS) || 4;
	console.log(`Number of threads: ${threads}`);

	console.log(`Checking ${resources.length}`);
	console.log('');

	const taskReport = (task, err) => {
		const ms = task.end - task.start;
		const state = err ? 'Error' : 'Done';
		const info = err ? `: ${err.message}` : '';

		console.log(`${task.resource.source}: ${state} (${ms}ms)${info}`);
	};

	const report = await new Promise((resolve, reject) => {
		const report = [];

		const taskEnd = (task, err) => {
			task.end = Date.now();
			report.push({task, err});
			taskReport(task);
		};

		const q = asyncQueue(async task => {
			task.start = Date.now();

			console.log(`${task.resource.source}: Checking`);

			const {response} = await requestPromise({
				method: 'HEAD',
				url: task.resource.source,
				followRedirect: false
			});

			const {statusCode} = response;
			if (statusCode !== 200) {
				throw new Error(`Unexpected status code: ${statusCode}`);
			}

			for (const [property, header] of headerMappings) {
				const expected = task.resource[property];
				const actual = response.headers[header];
				const actualValue = typeof expected === 'number' ?
					+actual : actual;

				if (actualValue !== expected) {
					throw new Error(
						`Unexpected ${header}: ${actualValue}` +
						` (expected ${expected})`
					);
				}
			}

			taskEnd(task, null);
		}, threads);

		q.error((err, task) => {
			taskEnd(task, err);
		});

		q.drai(() => {
			resolve(report);
		});

		for (const resource of resources) {
			q.push({resource, start: null, end: null});
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
