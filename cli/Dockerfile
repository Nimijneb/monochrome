# Self-contained CLI – build from cli/ folder only:
#   cd cli && docker build -t monochrome-cli .
FROM node:20-alpine

WORKDIR /app

# Copy entire cli folder (no parent monochrome app)
COPY . .

ENV MONOCHROME_DOWNLOAD_DIR=/staging

RUN chmod +x /app/docker-entrypoint.sh /app/run-and-sync.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD []
