# Базовый образ Node.js
FROM node:18

# Рабочая директория
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем всё приложение
COPY . .

# Порт, который Render использует по умолчанию
ENV PORT 3000

# Создаём папку для базы
RUN mkdir -p ./data

# Запуск сервера
CMD ["node", "server.js"]
