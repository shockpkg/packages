'use strict';

const request = require('request');

async function requestPromise(options) {
	const r = await new Promise((resolve, reject) => {
		request(options, (error, response, body) => {
			if (error) {
				reject(error);
				return;
			}
			resolve({
				response,
				body
			});
		});
	});
	return r;
}

exports.requestPromise = requestPromise;
