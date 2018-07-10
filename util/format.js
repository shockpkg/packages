'use strict';

const yaml = require('js-yaml');

function format(code) {
	const doc = yaml.safeLoad(code);
	const y = yaml.safeDump(doc, {
		lineWidth: 1000000,
		noRefs: true,
		indent: 2
	});
	const r = y
		.replace(/^(\s+- )/gm, '\n$1')
		.replace(/:\n\n/g, ':\n')
		.trim();
	return `${r}\n`;
}

exports.format = format;
