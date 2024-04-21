#!/usr/bin/env node

/* eslint-disable no-console */

import {rm} from 'node:fs/promises';
import {dirname, join as pathJoin} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dist = pathJoin(__dirname, '..', 'dist');

async function main() {
	await rm(dist, {recursive: true, force: true});
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
