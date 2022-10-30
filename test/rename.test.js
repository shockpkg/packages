'use strict';

const {URL} = require('url');
const {basename} = require('path');

const {entriesRoot, entriesChild} = require('./shared');

describe('rename', () => {
	describe('roots', () => {
		// Whitelist of renamed files.
		const renamed = {
			// None currently.
		};

		for (const entry of entriesRoot) {
			it(entry.name, () => {
				if (entry.name in renamed) {
					expect(entry.file).toBe(renamed[entry.name]);
				}
				else {
					const urlFile = decodeURI(
						(new URL(entry.source)).pathname
							.split('/').pop()
					);
					expect(entry.file).toBe(urlFile);
				}
			});
		}
	});

	describe('childs', () => {
		// Whitelist of renamed files.
		const renamed = {
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

		for (const entry of entriesChild) {
			it(entry.name, () => {
				if (entry.name in renamed) {
					expect(entry.file).toBe(renamed[entry.name]);
				}
				else {
					const pathFile = basename(entry.source);
					expect(entry.file).toBe(pathFile);
				}
			});
		}
	});
});
