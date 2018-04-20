#!/usr/bin/env bash
set -e

function_name="$1"

if [ "$function_name" = "" ] ; then
    echo "usage: ${0} [function name]"
    exit 1
fi

echo -n "Compressing... "
zip -r lambda.zip node_modules index.js package.json package-lock.json 1>/dev/null
echo "done"

echo -n "Uploading... "
aws lambda update-function-code --zip-file fileb://./lambda.zip --publish --function-name "${function_name}"

rm -f lambda.zip