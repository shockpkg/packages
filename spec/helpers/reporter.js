/* eslint-env jasmine */

'use strict';

var SpecReporter = require('jasmine-spec-reporter').SpecReporter;

// Only enable if requested, generates tons of output.
// eslint-disable-next-line no-process-env
if (/(1|true|yes)/i.test(process.env.SPEC_REPORTER)) {
	jasmine.getEnv().clearReporters();
	jasmine.getEnv().addReporter(new SpecReporter({
		spec: {
			displayPending: true,
			displayStacktrace: 'pretty'
		}
	}));
}
