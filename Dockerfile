# Simple multi-arch-friendly build for MoBingo
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
# Ensure clean cache + deterministic install
RUN npm config set registry https://registry.npmjs.org/ \
  && npm cache clean --force \
  && npm ci --omit=dev

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
