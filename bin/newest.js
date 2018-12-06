#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const asyncQueue = require('async/queue');

const {requestPromise} = require('../util/request');

const resources = [
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/cabs/director/sw.cab',
		size: 1291232,
		lastModified: 'Tue, 12 Jun 2018 05:27:49 GMT',
		eTag: '"13b3e0-56e6b20832b0a"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/Shockwave_Installer_Full.exe',
		size: 15124520,
		lastModified: 'Tue, 12 Jun 2018 05:27:57 GMT',
		eTag: '"e6c828-56e6b20fc3795"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/sw_lic_full_installer.exe',
		size: 13126968,
		lastModified: 'Tue, 12 Jun 2018 05:27:58 GMT',
		eTag: '"c84d38-56e6b2109ce97"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/sw_lic_full_installer.msi',
		size: 24260096,
		lastModified: 'Tue, 12 Jun 2018 05:27:25 GMT',
		eTag: '"1722e00-56e6b1f17edee"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/Shockwave_Installer_Slim.exe',
		size: 6256864,
		lastModified: 'Tue, 12 Jun 2018 05:27:55 GMT',
		eTag: '"5f78e0-56e6b20d70073"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/sw_lic_slim_installer.exe',
		size: 4262944,
		lastModified: 'Tue, 12 Jun 2018 05:27:55 GMT',
		eTag: '"410c20-56e6b20dc0c93"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/macosx/latest/Shockwave_Installer_Full_64bit.dmg',
		size: 18771823,
		lastModified: 'Thu, 29 Sep 2016 10:27:21 GMT',
		eTag: '"11e6f6f-53da2ec48cdf6"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/macosx/latest/Shockwave_Installer_Full.dmg',
		size: 22513907,
		lastModified: 'Thu, 04 Oct 2012 18:22:08 GMT',
		eTag: '"15788f3-4cb3fd5409400"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/macosx/latest/Shockwave_Installer_Slim.dmg',
		size: 3888494,
		lastModified: 'Thu, 04 Oct 2012 18:22:26 GMT',
		eTag: '"3b556e-4cb3fd6533c80"'
	}
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

		q.error = (err, task) => {
			taskEnd(task, err);
		};

		q.drain = () => {
			resolve(report);
		};

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
