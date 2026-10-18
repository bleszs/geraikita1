FROM node:24-bookworm-slim AS node-runtime
FROM python:3.13-slim-bookworm AS voice-runtime

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

COPY requirements-voice.txt ./
RUN python -m venv .venv-voice \
    && .venv-voice/bin/python -m pip install --no-cache-dir -r requirements-voice.txt
COPY models/speech-source.json models/speech-base-source.json models/
COPY scripts/setup-voice.py scripts/setup-voice.py
RUN .venv-voice/bin/python scripts/setup-voice.py \
    && .venv-voice/bin/python scripts/setup-voice.py --model base

# Explicit source copies: business databases, .env, local caches and demo data
# never enter the image. The persistent Railway volume is attached at runtime.
COPY package.json package-lock.json ./
COPY public/ public/
COPY server/ server/
COPY scripts/ scripts/

ENV NODE_ENV=production BIND_HOST=0.0.0.0 PYTHONUTF8=1 \
    HF_HUB_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 SPEECH_PROFILE=base-orders
CMD ["node", "scripts/serve.mjs"]
