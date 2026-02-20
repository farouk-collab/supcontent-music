FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json

RUN npm ci

COPY . .

RUN npm --workspace apps/api run build

EXPOSE 1234

CMD ["npm", "--workspace", "apps/api", "run", "start"]
