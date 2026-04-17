FROM mcr.microsoft.com/playwright:v1.41.0-jammy
WORKDIR /e2e
COPY package.json playwright.config.js api-helper.js ./
COPY *.spec.js ./
RUN npm install --silent
CMD ["npx", "playwright", "test", "--config=playwright.config.js"]
