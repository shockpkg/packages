'use strict';

const url = require('url');

const {doc, entriesRoot, entriesChild} = require('./shared');

const validators = {
	name: value => {
		expect(typeof value).toBe('string');
		expect(value.length).toBeGreaterThan(1);
		expect(value).toMatch(/^[-_.a-z0-9]+$/);
		expect(value).toMatch(/[a-z0-9]$/);
		expect(value).toMatch(/^[a-z0-9]/);
	},
	file: value => {
		expect(typeof value).toBe('string');
		expect(value.length).toBeGreaterThan(1);
		expect(value).toMatch(/^[-_.a-zA-Z0-9\x20()]+$/);
	},
	size: value => {
		expect(typeof value).toBe('number');
		expect(value).toBeGreaterThan(0);
		expect(value.toString()).toMatch(/^[0-9]+$/);
	},
	sha256: value => {
		expect(typeof value).toBe('string');
		expect(value.length).toBe(64);
		expect(value).toMatch(/^[a-z0-9]+$/);
	},
	url: value => {
		expect(typeof value).toBe('string');
		expect(value.length).toBeGreaterThan(0);
		expect(value).toMatch(/^https?:\/\//);
		const parsed = url.format(url.parse(value));
		expect(value).toBe(parsed);
	},
	path: value => {
		expect(typeof value).toBe('string');
		expect(value.length).toBeGreaterThan(0);
		expect(value.length).toMatch(/[^/\\]$/);
	}
};

describe('properties', () => {
	describe('keys', () => {
		const allowedProps = new Set([
			'format',
			'packages'
		]);

		for (const p of Object.keys(doc)) {
			it(p, () => {
				expect(allowedProps.has(p)).toBe(true);
			});
		}
	});

	describe('version', () => {
		it('value', () => {
			expect(doc.format).toBe('1.0');
		});
	});

	describe('packages', () => {
		describe('roots', () => {
			const allowedProps = new Set([
				'name',
				'file',
				'size',
				'sha256',
				'url',
				'packages'
			]);

			for (const entry of entriesRoot) {
				it(entry.name, () => {
					validators.name(entry.name);
					validators.file(entry.file);
					validators.size(entry.size);
					validators.sha256(entry.sha256);
					validators.url(entry.url);

					for (const p of Object.keys(entry)) {
						expect(allowedProps.has(p)).toBe(true);
					}

					if ('undefined' in entry) {
						expect(Array.isArray(entry.packages)).toBe(true);
					}
				});
			}
		});

		describe('childs', () => {
			const allowedProps = new Set([
				'name',
				'file',
				'size',
				'sha256',
				'path',
				'packages'
			]);

			for (const entry of entriesChild) {
				it(entry.name, () => {
					validators.name(entry.name);
					validators.file(entry.file);
					validators.size(entry.size);
					validators.sha256(entry.sha256);
					validators.path(entry.path);

					for (const p of Object.keys(entry)) {
						expect(allowedProps.has(p)).toBe(true);
					}

					if ('undefined' in entry) {
						expect(Array.isArray(entry.packages)).toBe(true);
					}
				});
			}
		});
	});
});
