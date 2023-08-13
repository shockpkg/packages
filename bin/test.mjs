#!/usr/bin/env node

/* eslint-disable no-console */

import {equal, match, ok} from 'assert/strict';
import {basename} from 'path';

import {read as readPackages} from '../util/packages.mjs';

async function properties() {
	const {roots, children, prefixes} = await readPackages();

	const validatorsRoot = {
		name: (root, value) => {
			equal(typeof value, 'string');
			match(value, /^[a-z][-a-z0-9_.]*[a-z0-9]$/);
			let prefixed = false;
			for (const prefix of prefixes) {
				if (!value.indexOf(`${prefix}-`)) {
					prefixed = true;
					break;
				}
			}
			ok(prefixed);
		},
		file: (root, value) => {
			equal(typeof value, 'string');
			match(value, /^[-_.a-zA-Z0-9\x20()]+$/);
		},
		size: (root, value) => {
			equal(typeof value, 'number');
			ok(value > 0);
		},
		sha256: (root, value) => {
			equal(typeof value, 'string');
			match(value, /^[a-z0-9]{64}$/);
		},
		sha1: (root, value) => {
			equal(typeof value, 'string');
			match(value, /^[a-z0-9]{40}$/);
		},
		md5: (root, value) => {
			equal(typeof value, 'string');
			match(value, /^[a-z0-9]{32}$/);
		},
		source: (root, value) => {
			equal(typeof value, 'string');
			if (root) {
				match(value, /^https:\/\//);
				equal(value, (new URL(value)).href);
			}
			else {
				match(value, /[^/\\]$/);
			}
		},
		packages: (root, value) => {
			if (typeof value !== 'undefined') {
				ok(Array.isArray(value));
			}
		},
		metadata: (root, value) => {
			if (value) {
				equal(typeof value, 'object');
			}
		}
	};
	const allowedPropsRoot = new Set(Object.keys(validatorsRoot));

	const validatorsChild = {
		...validatorsRoot,
		zipped: (root, value) => {
			match(value, /^(0|8)-\d+-\d+$/);
		}
	};
	const allowedPropsChild = new Set(Object.keys(validatorsChild));

	for (const entry of roots) {
		for (const p of Object.keys(validatorsRoot)) {
			validatorsRoot[p](true, entry[p]);
		}
		for (const p of Object.keys(entry)) {
			ok(allowedPropsRoot.has(p));
		}
	}

	for (const entry of children) {
		for (const p of Object.keys(validatorsChild)) {
			validatorsChild[p](false, entry[p]);
		}
		for (const p of Object.keys(entry)) {
			ok(allowedPropsChild.has(p));
		}
	}
}

async function rename() {
	const {roots, children} = await readPackages();

	const renamedRoot = {
		// None currently.
	};

	for (const entry of roots) {
		if (entry.name in renamedRoot) {
			equal(entry.file, renamedRoot[entry.name]);
		}
		else {
			const urlFile = decodeURIComponent(
				(new URL(entry.source)).pathname
					.split('/').pop()
			);
			equal(entry.file, urlFile);
		}
	}

	const renamedChild = {
		'flash-player-9.0.246.0-mac-ub-npapi-debug':
			'flashplayer9r246_ub_mac_debug.zip',

		'flash-player-10.0.42.34-mac-npapi-debug':
			'flashplayer10r42_34_ub_mac_debug.zip',

		'flash-player-11.0.1.152-linux-i386-npapi-debug':
			'flashplayer11_0r1_152_linux_debug.i386.tar.gz',

		'flash-player-11.0.1.152-windows-64bit-uninstaller':
			'uninstall_flashplayer11_0r1_152_win_64bit.exe',

		'flash-player-11.2.202.223-solaris-sparc-npapi':
			'flash_player11_2r202_223_solaris_sparc.tar.bz2',

		'flash-player-11.2.202.223-solaris-x86-npapi':
			'flash_player_11_2r202_223_solaris_x86.tar.bz2',

		'flash-player-11.3.300.262-windows-npapi-debug':
			'flashplayer11_3r300_262_win_debug.exe',

		'flash-player-11.3.300.262-windows-32bit-sa-debug':
			'flashplayer11_3r300_262_win_sa_debug_32bit.exe',

		'flash-player-11.5.502.110-windows-npapi-debug':
			'flashplayer11_5r502_110_win_debug.exe',

		'flash-player-12.0.0.70-windows-uninstaller':
			'uninstall_flashplayer12_0r0_70_win.exe'
	};

	for (const entry of children) {
		if (entry.name in renamedChild) {
			equal(entry.file, renamedChild[entry.name]);
		}
		else {
			equal(entry.file, basename(entry.source));
		}
	}
}

async function unique() {
	const {flat, roots} = await readPackages();

	const keys = new Set();
	for (const {name, sha256, sha1, md5} of flat) {
		ok(!keys.has(name));
		keys.add(name);

		ok(!keys.has(sha256));
		keys.add(sha256);

		ok(!keys.has(sha1));
		keys.add(sha1);

		ok(!keys.has(md5));
		keys.add(md5);
	}

	const urls = new Set();
	for (const {source} of roots) {
		ok(!urls.has(source));
		urls.add(source);
	}

	for (const {packages} of flat) {
		if (!packages) {
			continue;
		}

		const seen = new Set();
		for (const pkg of packages) {
			ok(!seen.has(pkg.source));
			seen.add(pkg.source);
		}
	}
}

async function main() {
	await properties();
	await rename();
	await unique();
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
