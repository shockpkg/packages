#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const fetch = require('node-fetch');

const {list, userAgent} = require('../util/flashcn');
const {flat} = require('../util/packages');

const expected = {
	'flash-player-34.0.0.267-windows-npapi-cn': '2022-08-09',
	'flash-player-34.0.0.267-windows-npapi-debug-cn': '09/08/2022',
	'flash-player-34.0.0.267-windows-ppapi-cn': '2022-08-09',
	'flash-player-34.0.0.267-windows-ppapi-debug-cn': '09/08/2022',
	'flash-player-34.0.0.267-windows-activex-cn': '2022-08-09',
	'flash-player-34.0.0.267-windows-activex-debug-cn': '09/08/2022',
	'flash-player-34.0.0.267-mac-npapi-cn': '2022-08-09',
	'flash-player-34.0.0.267-mac-ppapi-cn': '2022-08-09',
	'flash-player-34.0.0.267-windows-sa-cn': '09/08/2022',
	'flash-player-34.0.0.267-windows-sa-debug-cn': '09/08/2022',
	'flash-player-34.0.0.137-linux-i386-npapi-cn': '2021-04-13',
	'flash-player-34.0.0.137-linux-i386-npapi-rpm-cn': '2021-04-13',
	'flash-player-34.0.0.137-linux-i386-ppapi-cn': '2021-04-13',
	'flash-player-34.0.0.137-linux-i386-ppapi-rpm-cn': '2021-04-13',
	'flash-player-34.0.0.137-linux-x86_64-npapi-cn': '2021-04-13',
	'flash-player-34.0.0.137-linux-x86_64-npapi-rpm-cn': '2021-04-13',
	'flash-player-34.0.0.137-linux-x86_64-ppapi-cn': '2021-04-13',
	'flash-player-34.0.0.137-linux-x86_64-ppapi-rpm-cn': '2021-04-13',
	'flash-playerglobal-34.0.0.267-cn': '09/08/2022'
};

const byName = new Map(flat.map(o => [o.name, o]));

async function main() {
	const start = Date.now();
	const passed = new Set();
	const failed = new Set();

	const all = await list();
	for (const {name, source, date} of all) {
		console.log(`Checking: ${name}`);
		console.log(`URL: ${source}`);

		const dated = expected[name];
		const pkg = byName.get(name);
		if (!date || !pkg) {
			failed.add(name);
			console.log(`Error: Unknown package: ${name}`);
			console.log('');
			continue;
		}

		if (date !== dated) {
			failed.add(name);
			console.log(`Error: Unexpected date: ${date} != ${dated}`);
			console.log('');
			continue;
		}

		// eslint-disable-next-line no-await-in-loop
		const response = await fetch(source, {
			method: 'HEAD',
			headers: {
				'User-Agent': userAgent
			}
		});

		if (response.status !== 200) {
			failed.add(name);
			console.log(`Error: Status code: ${response.status}`);
			console.log('');
			continue;
		}

		const size = +response.headers.get('content-length');
		const sized = pkg.size;
		if (size !== sized) {
			failed.add(name);
			console.log(`Error: Unexpected size: ${size} != ${sized}`);
			console.log('');
			continue;
		}

		passed.add(name);
		console.log('');
	}

	const end = Date.now();

	console.log(`Passed: ${passed.size}`);
	console.log(`Failed: ${failed.size}`);
	console.log(`Done after ${end - start}ms`);
	console.log('');

	if (failed.size) {
		process.exitCode = 1;
	}
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
