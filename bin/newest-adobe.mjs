#!/usr/bin/env node

import {retry} from '../util/util.mjs';
import {queue} from '../util/queue.mjs';

// https://www.adobe.com/products/shockwaveplayer/shwv_distribution3.html
const resources = [
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/cabs/director/sw.cab',
		status: 404
		// status: 200,
		// size: 1292210,
		// lastModified: 'Tue, 26 Mar 2019 04:34:58 GMT',
		// eTag: '"13b7b2-584f7d7ef82db"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/Shockwave_Installer_Full.exe',
		status: 200,
		size: 15124440,
		lastModified: 'Fri, 12 Apr 2019 10:50:11 GMT',
		eTag: '"e6c7d8-586531128c3d0"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/sw_lic_full_installer.exe',
		status: 200,
		size: 13126832,
		lastModified: 'Fri, 12 Apr 2019 10:50:12 GMT',
		eTag: '"c84cb0-5865311315acb"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/sw_lic_full_installer.msi',
		status: 200,
		size: 24256512,
		lastModified: 'Fri, 12 Apr 2019 10:46:49 GMT',
		eTag: '"1722000-58653051e587f"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/Shockwave_Installer_Slim.exe',
		status: 200,
		size: 6257824,
		lastModified: 'Fri, 12 Apr 2019 10:50:07 GMT',
		eTag: '"5f7ca0-5865310e86db4"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/sw_lic_slim_installer.exe',
		status: 200,
		size: 4262176,
		lastModified: 'Fri, 12 Apr 2019 10:50:07 GMT',
		eTag: '"410920-5865310eb2c5a"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/sw_lic_full_installerj.exe',
		status: 200,
		size: 13126832,
		lastModified: 'Fri, 12 Apr 2019 10:50:08 GMT',
		eTag: '"c84cb0-5865310f2becc"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/win95nt/latest/sw_lic_slim_installerj.exe',
		status: 200,
		size: 4262176,
		lastModified: 'Fri, 12 Apr 2019 10:50:07 GMT',
		eTag: '"410920-5865310eda9c4"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/macosx/latest/Shockwave_Installer_Full_64bit.dmg',
		status: 200,
		size: 18771823,
		lastModified: 'Mon, 15 Apr 2019 05:30:08 GMT',
		eTag: '"11e6f6f-5868af21a4ce4"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/macosx/latest/Shockwave_Installer_Full.dmg',
		status: 404
		// status: 200,
		// size: 22513907,
		// lastModified: 'Thu, 04 Oct 2012 18:22:08 GMT',
		// eTag: '"15788f3-4cb3fd5409400"'
	},
	{
		source: 'https://fpdownload.macromedia.com/get/shockwave/default/english/macosx/latest/Shockwave_Installer_Slim.dmg',
		status: 404
		// status: 200,
		// size: 3888494,
		// lastModified: 'Thu, 04 Oct 2012 18:22:26 GMT',
		// eTag: '"3b556e-4cb3fd6533c80"'
	}
];

// Check for any possible release of post-EOL versions.
for (const i of [33, 34, 35]) {
	for (const f of [
		`flashplayer_${i}_sa.exe`,
		`flashplayer_${i}_sa_debug.exe`,
		`flashplayer_${i}_sa.dmg`,
		`flashplayer_${i}_sa_debug.dmg`,
		'flash_player_sa_linux.x86_64.tar.gz',
		'flash_player_sa_linux_debug.x86_64.tar.gz'
	]) {
		resources.push({
			source: `https://fpdownload.macromedia.com/get/flashplayer/updaters/${i}/${f}`,
			status: 302,
			location:
				'https://www.adobe.com/products/flashplayer/end-of-life.html'
		});
	}
}

const headerMappings = [
	['size', 'content-length'],
	['lastModified', 'last-modified'],
	['eTag', 'etag'],
	['location', 'location']
];

const each = async resource => {
	const {source: url, status: statusE} = resource;
	const response = await retry(() =>
		fetch(url, {
			method: 'HEAD',
			redirect: 'manual'
		})
	);
	const {status, headers} = response;

	if (status !== statusE) {
		throw new Error(`Status code: ${status} != ${statusE}: ${url}`);
	}

	for (const [property, header] of headerMappings) {
		const expected = resource[property];
		// eslint-disable-next-line no-undefined
		if (expected === undefined) {
			continue;
		}

		const actual = headers.get(header);
		const value = typeof expected === 'number' ? +actual : actual;

		if (value !== expected) {
			throw new Error(
				`Unexpected ${header}: ${value} (expected ${expected})`
			);
		}
	}
};

async function main() {
	// eslint-disable-next-line no-process-env
	const threads = +process.env.SHOCKPKG_NEWEST_THREADS || 4;

	console.log(`Threads: ${threads}`);
	console.log(`Checking: ${resources.length}`);

	const passed = [];
	const failed = [];
	await queue(
		resources,
		async resource => {
			console.log(`${resource.source}: Check`);
			await retry(() => each(resource))
				.then(() => {
					console.log(`${resource.source}: Pass`);
					passed.push(resource);
				})
				.catch(err => {
					console.log(`${resource.source}: Fail: ${err.message}`);
					failed.push(resource);
				});
		},
		threads
	);

	console.log(`Passed: ${passed.length}`);
	console.log(`Failed: ${failed.length}`);

	if (failed.length) {
		process.exitCode = 1;
	}
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
