#!/usr/bin/env node

'use strict';

const fse = require('fs-extra');
const path = require('path');

const packages = require('../util/packages');

const dist = path.join(__dirname, '..', 'dist');
const file = 'packages.json';

async function writeFile(file, data) {
	await fse.mkdirp(path.dirname(file));
	await fse.writeFile(file, data);
}

async function main() {
	const pkgs = packages.packages;

	await writeFile(path.join(dist, '1', file), JSON.stringify({
		format: '1.0',
		packages: pkgs
	}));
}
main().catch(err => {
	// eslint-disable-next-line no-console
	console.error(err);
	process.exitCode = 1;
});
