# WhatsApp QC Price Optimizer — production image.
# Uses the distro's Chromium (via PUPPETEER_EXECUTABLE_PATH) so Puppeteer and
# whatsapp-web.js share one browser instead of downloading their own.
FROM node:20-bookworm-slim

# Chromium + the shared libs headless Chrome needs, plus fonts for correct
# rendering (₹ glyph, emoji).
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      fonts-noto-color-emoji \
      libnss3 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2 \
      dumb-init \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

# Install deps first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Persist the WhatsApp session AND tracked-products data across restarts.
VOLUME ["/app/.wwebjs_auth", "/app/data"]

# dumb-init reaps the zombie processes Chromium leaves behind.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
