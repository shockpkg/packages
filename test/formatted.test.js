'use strict';

const {format} = require('../util/format');
const {yaml} = require('./shared');

describe('formatted', () => {
	it('yaml is formatted', () => {
		// Check if code matches what it would if was formatted.
		expect(yaml === format(yaml)).toBe(true);
	});
});
