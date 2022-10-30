'use strict';

const {createWriteStream} = require('fs');
const {pipeline} = require('stream');

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

async function requestDownloadPromise(
	options, outfile, onresponse = null, ondata = null
) {
	const r = await new Promise((resolve, reject) => {
		const req = request(options);
		if (onresponse) {
			req.on('response', onresponse);
		}
		if (ondata) {
			req.on('data', ondata);
		}
		const fout = createWriteStream(outfile);
		pipeline(req, fout, err => {
			if (onresponse) {
				req.removeListener('response', onresponse);
			}
			if (ondata) {
				req.removeListener('data', ondata);
			}
			if (err) {
				reject(err);
				return;
			}
			resolve();
		});
	});
	return r;
}

exports.requestPromise = requestPromise;
exports.requestDownloadPromise = requestDownloadPromise;
