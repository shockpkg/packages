'use strict';

const {createWriteStream} = require('fs');
const {pipeline} = require('stream');

const request = require('request');

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

exports.requestDownloadPromise = requestDownloadPromise;
