# Build client
FROM node:22-alpine AS client-builder
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client ./client/
RUN cd client && npm run build

# Build server
FROM node:22-alpine AS server-builder
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server ./server/
RUN cd server && npm run build

# Production image
FROM node:22-alpine AS production
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY server/package*.json ./
RUN npm install --omit=dev

COPY --from=server-builder /app/server/dist ./dist
COPY --from=client-builder /app/client/dist ./public

RUN mkdir -p /data

EXPOSE 3001
CMD ["node", "dist/index.js"]
