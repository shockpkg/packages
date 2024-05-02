#!/usr/bin/env node

/* eslint-disable no-console */

import {rm} from 'node:fs/promises';

const dist = 'dist';

async function main() {
	await rm(dist, {recursive: true, force: true});
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
