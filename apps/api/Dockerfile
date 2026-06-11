FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY . .

RUN npm --workspace apps/api run build

EXPOSE 1234

CMD ["npm", "--workspace", "apps/api", "run", "start"]
