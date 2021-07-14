#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const path = require('path');

const fse = require('fs-extra');

const gencache = require('../util/gencache');
const hash = require('../util/hash');
const yaml = require('../util/yaml');

const packagesDir = path.join(path.dirname(__dirname), 'packages');

function genList(version) {
	const [versionMajor] = version.split('.');
	// Licensed installers are here, but they are all login protected:
	// https://fpdownload.macromedia.com/get/flashplayer/distyfp/current/OS/FILE
	return [
		[
			`flash-player-${version}-windows-npapi`,
			`https://fpdownload.macromedia.com/get/flashplayer/pdc/${version}/install_flash_player.exe`
		],
		[
			`flash-player-${version}-windows-npapi-msi`,
			`https://fpdownload.macromedia.com/get/flashplayer/pdc/${version}/install_flash_player_${versionMajor}_plugin.msi`
		],
		[
			`flash-player-${version}-windows-npapi-debug`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flashplayer_${versionMajor}_plugin_debug.exe`
		],
		[
			`flash-player-${version}-windows-ppapi`,
			`https://fpdownload.macromedia.com/get/flashplayer/pdc/${version}/install_flash_player_ppapi.exe`
		],
		[
			`flash-player-${version}-windows-ppapi-msi`,
			`https://fpdownload.macromedia.com/get/flashplayer/pdc/${version}/install_flash_player_${versionMajor}_ppapi.msi`
		],
		[
			`flash-player-${version}-windows-ppapi-debug`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flashplayer_${versionMajor}_ppapi_debug.exe`
		],
		[
			`flash-player-${version}-windows-activex`,
			`https://fpdownload.macromedia.com/get/flashplayer/pdc/${version}/install_flash_player_ax.exe`
		],
		[
			`flash-player-${version}-windows-activex-msi`,
			`https://fpdownload.macromedia.com/get/flashplayer/pdc/${version}/install_flash_player_${versionMajor}_active_x.msi`
		],
		[
			`flash-player-${version}-windows-activex-debug`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flashplayer_${versionMajor}_ax_debug.exe`
		],
		[
			`flash-player-${version}-windows-sa`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flashplayer_${versionMajor}_sa.exe`
		],
		[
			`flash-player-${version}-windows-sa-debug`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flashplayer_${versionMajor}_sa_debug.exe`
		],
		[
			`flash-player-${version}-windows-uninstaller`,
			'https://fpdownload.macromedia.com/get/flashplayer/current/support/uninstall_flash_player.exe'
		],
		[
			`flash-player-${version}-mac-npapi`,
			`https://fpdownload.macromedia.com/get/flashplayer/pdc/${version}/install_flash_player_osx.dmg`
		],
		// PKG version not available outside licensed?
		// `install_flash_player_${versionMajor}_osx_pkg.dmg`
		[
			`flash-player-${version}-mac-npapi-debug`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flashplayer_${versionMajor}_plugin_debug.dmg`
		],
		[
			`flash-player-${version}-mac-ppapi`,
			`https://fpdownload.macromedia.com/get/flashplayer/pdc/${version}/install_flash_player_osx_ppapi.dmg`
		],
		// PKG version not available outside licensed?
		// `install_flash_player_${versionMajor}_osx_ppapi_pkg.dmg`
		[
			`flash-player-${version}-mac-ppapi-debug`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flashplayer_${versionMajor}_ppapi_debug.dmg`
		],
		[
			`flash-player-${version}-mac-sa`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flashplayer_${versionMajor}_sa.dmg`
		],
		[
			`flash-player-${version}-mac-sa-debug`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flashplayer_${versionMajor}_sa_debug.dmg`
		],
		[
			`flash-player-${version}-mac-uninstaller`,
			'https://fpdownload.macromedia.com/get/flashplayer/current/support/uninstall_flash_player_osx.dmg'
		],
		[
			`flash-player-${version}-linux-i386-npapi`,
			`https://fpdownload.macromedia.com/get/flashplayer/pdc/${version}/flash_player_npapi_linux.i386.tar.gz`
		],
		[
			`flash-player-${version}-linux-i386-npapi-debug`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flash_player_npapi_linux_debug.i386.tar.gz`
		],
		[
			`flash-player-${version}-linux-i386-ppapi`,
			`https://fpdownload.macromedia.com/get/flashplayer/pdc/${version}/flash_player_ppapi_linux.i386.tar.gz`
		],
		[
			`flash-player-${version}-linux-x86_64-npapi`,
			`https://fpdownload.macromedia.com/get/flashplayer/pdc/${version}/flash_player_npapi_linux.x86_64.tar.gz`
		],
		[
			`flash-player-${version}-linux-x86_64-npapi-debug`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flash_player_npapi_linux_debug.x86_64.tar.gz`
		],
		[
			`flash-player-${version}-linux-x86_64-ppapi`,
			`https://fpdownload.macromedia.com/get/flashplayer/pdc/${version}/flash_player_ppapi_linux.x86_64.tar.gz`
		],
		[
			`flash-player-${version}-linux-x86_64-ppapi-debug`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flash_player_ppapi_linux_debug.x86_64.tar.gz`
		],
		[
			`flash-player-${version}-linux-x86_64-sa`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flash_player_sa_linux.x86_64.tar.gz`
		],
		[
			`flash-player-${version}-linux-x86_64-sa-debug`,
			`https://fpdownload.macromedia.com/get/flashplayer/updaters/${versionMajor}/flash_player_sa_linux_debug.x86_64.tar.gz`
		]
	];
}

async function main() {
	const args = process.argv.slice(2);
	if (args.length < 1) {
		throw new Error('Missing version argument');
	}
	const [version] = args;

	const file = path.join(packagesDir, 'flash-player', `${version}.yaml`);

	const doc = [];
	const list = genList(version);
	for (const [name, url] of list) {
		console.log(`Name: ${name}`);
		console.log(`URL: ${url}`);

		let cached = null;
		try {
			// eslint-disable-next-line no-await-in-loop
			cached = await gencache.ensure(name, url, progress => {
				const percent = progress * 100;
				process.stdout.write(
					`\rDownloading: ${percent.toFixed(2)}%\r`
				);
			});
			if (cached.downloaded) {
				console.log('');
			}
			else {
				console.log('Cached');
			}
		}
		catch (err) {
			console.log(err);
			console.log('');
			continue;
		}

		// eslint-disable-next-line no-await-in-loop
		const data = await fse.readFile(cached.filepath);
		const size = data.length;
		console.log(`Size: ${size}`);

		const [sha256, sha1, md5] =
			// eslint-disable-next-line no-await-in-loop
			await hash.buffer(data, ['sha256', 'sha1', 'md5']);
		console.log(`SHA256: ${sha256}`);
		console.log(`SHA1: ${sha1}`);
		console.log(`MD5: ${md5}`);

		doc.push({
			name,
			file: url.split('/').pop(),
			size,
			sha256,
			sha1,
			md5,
			source: url
		});

		console.log('');
	}

	console.log(`Writing: ${file}`);

	const data = yaml.packages(doc);
	await fse.writeFile(file, data, 'utf8');

	console.log('Done');
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
