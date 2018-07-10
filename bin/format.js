#!/usr/bin/env node

'use strict';

const fs = require('fs');

const {format} = require('../util/format');

const args = process.argv.slice(2);
if (args.length !== 1) {
	// eslint-disable-next-line no-console
	console.log('Requires a file argument');
	process.exitCode = 1;
	return;
}

const [file] = args;

// eslint-disable-next-line no-sync
const code = fs.readFileSync(file, 'utf8');

const formatted = format(code);

// eslint-disable-next-line no-sync
fs.writeFileSync(file, formatted);
