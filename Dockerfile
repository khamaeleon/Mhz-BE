FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# package-lock.json 이 생기면 npm ci 로 바꾼다
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src
COPY scripts ./scripts
COPY db ./db

USER node
EXPOSE 4100
CMD ["node", "src/server.js"]
