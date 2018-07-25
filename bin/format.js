#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const {format} = require('../util/format');

const file = path.join(__dirname, '..', 'packages.yaml');

// eslint-disable-next-line no-sync
const code = fs.readFileSync(file, 'utf8');

const formatted = format(code);

// eslint-disable-next-line no-sync
fs.writeFileSync(file, formatted);
