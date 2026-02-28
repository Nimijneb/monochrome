#!/bin/sh
set -e

# Download to staging first; when the CLI exits successfully, copy to final folder.
STAGING_DIR="${MONOCHROME_STAGING_DIR:-/staging}"
OUTPUT_DIR="${MONOCHROME_OUTPUT_DIR:-/output}"

mkdir -p "$STAGING_DIR"
export MONOCHROME_DOWNLOAD_DIR="$STAGING_DIR"

# Run the CLI with any arguments (e.g. artist name). Run from /app so imports resolve.
cd /app && node index.js "$@"
status=$?

# On success, merge staging into the output directory (mounted volume).
if [ $status -eq 0 ] && [ -d "$OUTPUT_DIR" ]; then
    if [ -n "$(ls -A "$STAGING_DIR" 2>/dev/null)" ]; then
        echo ""
        echo "Copying to final folder: $OUTPUT_DIR"
        cp -r "${STAGING_DIR}/." "$OUTPUT_DIR/"
        echo "Done."
    fi
fi

exit $status
