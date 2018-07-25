#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const yaml = require('js-yaml');

const file = path.join(__dirname, '..', 'packages.yaml');
const dist = path.join(__dirname, '..', 'dist');
const packages = 'packages.json';

function mkdirSync(p) {
	try {
		fs.mkdirSync(p);
	}
	catch (err) {
		if (err.code !== 'EEXIST') {
			throw err;
		}
	}
}

// eslint-disable-next-line no-sync
const code = fs.readFileSync(file, 'utf8');

const doc = yaml.safeLoad(code);

mkdirSync(dist);

mkdirSync(path.join(dist, '1'));

// eslint-disable-next-line no-sync
fs.writeFileSync(path.join(dist, '1', packages), JSON.stringify({
	format: '1.0',
	packages: doc
}));
