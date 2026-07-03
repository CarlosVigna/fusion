# mcr.microsoft.com/playwright/node:20-jammy already ships the exact
# Chromium build that matches the installed Playwright version, plus all
# required system libraries — no manual apt installs needed.
FROM mcr.microsoft.com/playwright/node:20-jammy

WORKDIR /app

# Dependencies first so this layer is cached on code-only changes
COPY package*.json ./
RUN npm ci --omit=dev

# Install the Chromium browser that matches the pinned Playwright version
RUN npx playwright install chromium

# Application source
COPY . .

# Runtime data dirs (overridable via env)
RUN mkdir -p /app/data/downloads /app/data/pending /app/logs

# ── Required ──────────────────────────────────────────────────────────────
# BACKEND_URL          e.g. https://fusion-backend.onrender.com
# ETL_API_KEY          shared secret for X-ETL-Key header
# MULTIPORTAL_USER     Multiportal login username
# MULTIPORTAL_PASSWORD Multiportal login password
# MULTIPORTAL_URL      Multiportal base URL (e.g. https://multiportal.example.com)
#
# ── Optional (have sane defaults) ─────────────────────────────────────────
ENV ETL_HEADLESS=true \
    ETL_DOWNLOADS_DIR=/app/data/downloads \
    ETL_OUTPUT_DIR=/app/data/pending \
    ETL_TEMP_DIR=/app/data/temp \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

CMD ["node", "scheduler.js"]
