FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production=false

COPY . .

RUN npx tsc || true
RUN test -f dist/server.js || (echo "Build failed: dist/server.js not found" && exit 1)

RUN mkdir -p /app/uploads/portfolios /app/uploads/verification-docs \
    /app/uploads/settlement-attachments /app/uploads/report-evidence \
    /app/uploads/deliverables /app/uploads/exports

EXPOSE 3001

CMD ["node", "dist/server.js"]
