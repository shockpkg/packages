#!/bin/bash

set -euo pipefail

echo 'Triggering an API update'

curl -s -X POST \
   -H 'Content-Type: application/json' \
   -H 'Accept: application/json' \
   -H 'Travis-API-Version: 3' \
   -H "Authorization: token $TRAVIS_TOKEN" \
   -d '{"request":{"branch":"dev"}}' \
   'https://api.travis-ci.org/repo/flpkg%2Fflpkg.github.io/requests'

echo 'Triggered an API update'
