'use strict';

const path = require('path');

const fse = require('fs-extra');
const yaml = require('js-yaml');

async function read(type, version) {
	const dir = path.join(__dirname, '..', 'packages');
	return yaml.safeLoad(
		await fse.readFile(path.join(dir, type, `${version}.yaml`))
	);
}

exports.read = read;
