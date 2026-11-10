# Game server + built client in one image. Works on any container host (Fly.io, Railway, Koyeb, a VPS).
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci --include=dev
COPY . .
RUN npm run build
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["npm", "start"]
