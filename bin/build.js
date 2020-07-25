#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const fse = require('fs-extra');
const path = require('path');

const packages = require('../util/packages');

const dist = path.join(__dirname, '..', 'dist');
const distApi = path.join(dist, 'api');
const file = 'packages.json';

async function writeFile(file, data) {
	await fse.mkdirp(path.dirname(file));
	await fse.writeFile(file, data);
}

async function main() {
	const pkgs = packages.packages;

	await writeFile(path.join(distApi, '1', file), JSON.stringify({
		format: '1.1',
		packages: pkgs
	}));
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
