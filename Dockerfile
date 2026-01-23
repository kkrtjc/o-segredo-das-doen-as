# Use uma imagem leve do Node.js
FROM node:18-alpine

# Cria a pasta do app dentro do container
WORKDIR /app

# Copia os arquivos de configuração de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia todo o resto do código
COPY . .

# Expõe a porta que o servidor usa
EXPOSE 10000

# Comando para iniciar diretamente (melhor para Docker)
CMD ["node", "server.js"]
