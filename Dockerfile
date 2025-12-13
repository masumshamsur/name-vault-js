FROM node:18-alpine

WORKDIR /app

COPY app/package*.json ./
RUN npm ci --only=production

COPY app/ .

EXPOSE 3000

CMD ["node", "src/app.js"]
