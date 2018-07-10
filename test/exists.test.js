'use strict';

const {requestPromise} = require('../util/request');

const {asyncTimeout, entriesRoot} = require('./shared');

describe('exists', () => {
	describe('url', () => {
		for (const entry of entriesRoot) {
			it(entry.name, async () => {
				const {response} = await requestPromise({
					method: 'HEAD',
					url: entry.url,
					followRedirect: false
				});

				expect(response.statusCode).toBe(200);

				const contentLength = +response.headers['content-length'];

				expect(contentLength).toBe(entry.size);
			}, asyncTimeout);
		}
	});
});
