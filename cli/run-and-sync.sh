#!/bin/sh
# Run the CLI with the given args, then copy /staging to /output on success.
# Use this when you're inside the container console (e.g. after docker compose exec cli sh).
set -e
STAGING_DIR="${MONOCHROME_STAGING_DIR:-/staging}"
OUTPUT_DIR="${MONOCHROME_OUTPUT_DIR:-/output}"

export MONOCHROME_DOWNLOAD_DIR="$STAGING_DIR"
mkdir -p "$STAGING_DIR"

cd /app && node index.js "$@"
status=$?

if [ $status -eq 0 ] && [ -d "$OUTPUT_DIR" ] && [ -n "$(ls -A "$STAGING_DIR" 2>/dev/null)" ]; then
    echo ""
    echo "Copying to final folder: $OUTPUT_DIR"
    cp -r "${STAGING_DIR}/." "$OUTPUT_DIR/"
    echo "Done."
fi
exit $status
