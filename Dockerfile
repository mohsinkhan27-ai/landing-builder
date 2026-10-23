FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PLAYWRIGHT_BROWSERS_PATH=0

COPY package.json package-lock.json ./
RUN npm ci

RUN npx playwright-core install --with-deps chromium

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "server.js", "--prod"]
