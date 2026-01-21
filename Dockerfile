FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expõe a porta 3000
EXPOSE 3000

# Variáveis de ambiente padrão
ENV PORT=3000

CMD ["node", "server.js"]
