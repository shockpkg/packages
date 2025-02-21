#!/usr/bin/env node

import {equal, match, ok} from 'node:assert/strict';
import {basename} from 'node:path';

import {read as packaged} from '../util/packages.mjs';
import {walk} from '../util/util.mjs';

async function properties(packages) {
	const validatorsRoot = {
		name: (root, value) => {
			equal(typeof value, 'string');
			match(value, /^[a-z][\d._a-z-]*[\da-z]$/);
		},
		file: (root, value) => {
			equal(typeof value, 'string');
			match(value, /^[\w ().-]+$/);
		},
		size: (root, value) => {
			equal(typeof value, 'number');
			ok(value > 0);
		},
		sha256tree: (root, value) => {
			equal(typeof value, 'string');
			match(value, /^[\da-z]{64}$/);
		},
		sha256: (root, value) => {
			equal(typeof value, 'string');
			match(value, /^[\da-z]{64}$/);
		},
		sha1: (root, value) => {
			equal(typeof value, 'string');
			match(value, /^[\da-z]{40}$/);
		},
		md5: (root, value) => {
			equal(typeof value, 'string');
			match(value, /^[\da-z]{32}$/);
		},
		source: (root, value) => {
			equal(typeof value, 'string');
			if (root) {
				match(value, /^https:\/\//);
				equal(value, new URL(value).href);
			} else {
				match(value, /[^/\\]$/);
			}
		},
		packages: (root, value) => {
			ok(value === undefined || Array.isArray(value));
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

	for (const [pkg, parents] of walk(packages, p => p.packages)) {
		if (parents.length) {
			for (const p of Object.keys(validatorsChild)) {
				validatorsChild[p](false, pkg[p]);
			}
			for (const p of Object.keys(pkg)) {
				ok(allowedPropsChild.has(p));
			}
		} else {
			for (const p of Object.keys(validatorsRoot)) {
				validatorsRoot[p](true, pkg[p]);
			}
			for (const p of Object.keys(pkg)) {
				ok(allowedPropsRoot.has(p));
			}
		}
	}
}

async function unique(packages) {
	const keys = new Set();
	const urls = new Set();

	for (const [pkg, parents] of walk(packages, p => p.packages)) {
		ok(!keys.has(pkg.name));
		keys.add(pkg.name);

		ok(!keys.has(pkg.sha256tree));
		ok(!keys.has(pkg.sha256));
		keys.add(pkg.sha256tree);
		keys.add(pkg.sha256);

		ok(!keys.has(pkg.sha1));
		keys.add(pkg.sha1);

		ok(!keys.has(pkg.md5));
		keys.add(pkg.md5);

		if (!parents.length) {
			ok(!urls.has(pkg.source));
			urls.add(pkg.source);
		}

		const sources = new Set();
		for (const p of pkg.packages || []) {
			ok(!sources.has(p.source));
			sources.add(p.source);
		}
	}
}

async function rename(packages) {
	const renamedRoot = {
		// None currently.
	};

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

	for (const [pkg, parents] of walk(packages, p => p.packages)) {
		if (parents.length) {
			if (pkg.name in renamedChild) {
				equal(pkg.file, renamedChild[pkg.name]);
			} else {
				equal(pkg.file, basename(pkg.source));
			}
			continue;
		}

		if (pkg.name in renamedRoot) {
			equal(pkg.file, renamedRoot[pkg.name]);
		} else {
			equal(
				pkg.file,
				decodeURIComponent(
					new URL(pkg.source).pathname.split('/').pop()
				)
			);
		}
	}
}

async function main() {
	const packages = await packaged();
	await properties(packages);
	await unique(packages);
	await rename(packages);
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
