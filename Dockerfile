# Simple multi-arch-friendly build for MoBingo
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
# Ensure clean cache + deterministic, avoid stale tarballs
RUN npm config set registry https://registry.npmjs.org/ \
  && npm config set prefer-online true \
  && npm config set cache /tmp/.npm \
  && npm cache clean --force \
  && npm ci --omit=dev --prefer-online

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
