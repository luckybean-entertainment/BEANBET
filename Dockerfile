# Официальный образ Node.js LTS – лучше всего подходит для better-sqlite3
FROM node:18

# Создаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем весь проект внутрь контейнера
COPY . .

# Открываем порт для Render (он использует $PORT)
EXPOSE 3000

# Запуск сервера
CMD ["node", "server.js"]
