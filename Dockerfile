FROM node:20-alpine

WORKDIR /app

# Instala dependencias primero (aprovecha cache de Docker)
COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
