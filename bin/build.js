#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const {mkdir, writeFile} = require('fs/promises');

const {dirname, join: pathJoin} = require('path');

const packages = require('../util/packages');

const dist = pathJoin(__dirname, '..', 'dist');
const distApi = pathJoin(dist, 'api');
const file = 'packages.json';

async function outputFile(file, data) {
	await mkdir(dirname(file), {recursive: true});
	await writeFile(file, data);
}

async function main() {
	const pkgs = packages.packages;

	await outputFile(pathJoin(distApi, '1', file), JSON.stringify({
		format: '1.2',
		packages: pkgs
	}));
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
