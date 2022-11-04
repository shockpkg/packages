'use strict';

const {entriesRoot, entriesChild} = require('./shared');

const validatorsRoot = {
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
			const parsed = (new URL(value)).href;
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
const allowedPropsRoot = new Set(Object.keys(validatorsRoot));

const validatorsChild = {
	...validatorsRoot,
	zipped: (root, value) => {
		expect(value).toMatch(/^(0|8)-\d+-\d+$/);
	}
};
const allowedPropsChild = new Set(Object.keys(validatorsChild));

describe('properties', () => {
	describe('packages', () => {
		describe('roots', () => {
			for (const entry of entriesRoot) {
				it(entry.name, () => {
					for (const p of Object.keys(validatorsRoot)) {
						validatorsRoot[p](true, entry[p]);
					}
					for (const p of Object.keys(entry)) {
						expect(allowedPropsRoot.has(p)).toBe(true);
					}
				});
			}
		});

		describe('childs', () => {
			for (const entry of entriesChild) {
				it(entry.name, () => {
					for (const p of Object.keys(validatorsChild)) {
						validatorsChild[p](false, entry[p]);
					}
					for (const p of Object.keys(entry)) {
						expect(allowedPropsChild.has(p)).toBe(true);
					}
				});
			}
		});
	});
});
