#!/usr/bin/env node

/* eslint-disable no-console */

import {mkdir, writeFile} from 'fs/promises';
import {dirname, join as pathJoin} from 'path';
import {fileURLToPath} from 'url';

import {packages} from '../util/packages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dist = pathJoin(__dirname, '..', 'dist');
const distApi = pathJoin(dist, 'api');
const file = 'packages.json';

async function outputFile(file, data) {
	await mkdir(dirname(file), {recursive: true});
	await writeFile(file, data);
}

async function main() {
	await outputFile(pathJoin(distApi, '1', file), JSON.stringify({
		format: '1.2',
		packages
	}));
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
