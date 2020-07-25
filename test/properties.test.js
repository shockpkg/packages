'use strict';

const url = require('url');

const {entriesRoot, entriesChild} = require('./shared');

const validators = {
	name: (root, value) => {
		expect(typeof value).toBe('string');
		expect(value.length).toBeGreaterThan(1);
		expect(value).toMatch(/^[-_.a-z0-9]+$/);
		expect(value).toMatch(/[a-z0-9]$/);
		expect(value).toMatch(/^[a-z0-9]/);
	},
	file: (root, value) => {
		expect(typeof value).toBe('string');
		expect(value.length).toBeGreaterThan(1);
		expect(value).toMatch(/^[-_.a-zA-Z0-9\x20()]+$/);
	},
	size: (root, value) => {
		expect(typeof value).toBe('number');
		expect(value).toBeGreaterThan(0);
		expect(value.toString()).toMatch(/^[0-9]+$/);
	},
	sha256: (root, value) => {
		expect(typeof value).toBe('string');
		expect(value.length).toBe(64);
		expect(value).toMatch(/^[a-z0-9]+$/);
	},
	sha1: (root, value) => {
		expect(typeof value).toBe('string');
		expect(value.length).toBe(40);
		expect(value).toMatch(/^[a-z0-9]+$/);
	},
	md5: (root, value) => {
		expect(typeof value).toBe('string');
		expect(value.length).toBe(32);
		expect(value).toMatch(/^[a-z0-9]+$/);
	},
	source: (root, value) => {
		expect(typeof value).toBe('string');
		expect(value.length).toBeGreaterThan(0);
		if (root) {
			expect(value).toMatch(/^https:\/\//);
			const parsed = url.format(url.parse(value));
			expect(value).toBe(parsed);
		}
		else {
			expect(value.length).toMatch(/[^/\\]$/);
		}
	},
	packages: (root, value) => {
		if (value) {
			expect(Array.isArray(value)).toBe(true);
		}
		else {
			expect(typeof value).toBe('undefined');
		}
	}
};
const allowedProps = new Set(Object.keys(validators));

describe('properties', () => {
	describe('packages', () => {
		describe('roots', () => {
			for (const entry of entriesRoot) {
				it(entry.name, () => {
					for (const p of Object.keys(validators)) {
						validators[p](true, entry[p]);
					}
					for (const p of Object.keys(entry)) {
						expect(allowedProps.has(p)).toBe(true);
					}
				});
			}
		});

		describe('childs', () => {
			for (const entry of entriesChild) {
				it(entry.name, () => {
					for (const p of Object.keys(validators)) {
						validators[p](false, entry[p]);
					}
					for (const p of Object.keys(entry)) {
						expect(allowedProps.has(p)).toBe(true);
					}
				});
			}
		});
	});
});
