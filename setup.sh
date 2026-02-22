#!/usr/bin/env bash

# Настройка цветов для красивого вывода в терминал
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}   🚀 Инициализация Nexus AI-First IDE    ${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""

# 1. Проверка наличия Git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git не установлен. Пожалуйста, установите Git и повторите попытку.${NC}"
    exit 1
fi

# 2. Проверка версии Node.js (требуется >= 18)
NODE_VERSION=$(node -v | cut -d 'v' -f 2)
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d '.' -f 1)

if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${RED}❌ Ошибка: Требуется Node.js версии 18 или выше. Текущая версия: $NODE_VERSION${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Node.js версии $NODE_VERSION найдена.${NC}"
fi

# 3. Проверка версии npm (требуется >= 9)
NPM_VERSION=$(npm -v)
NPM_MAJOR=$(echo "$NPM_VERSION" | cut -d '.' -f 1)

if [ "$NPM_MAJOR" -lt 9 ]; then
    echo -e "${RED}❌ Ошибка: Требуется npm версии 9 или выше. Текущая версия: $NPM_VERSION${NC}"
    exit 1
else
    echo -e "${GREEN}✅ npm версии $NPM_VERSION найден.${NC}"
fi

echo ""
echo -e "${YELLOW}📦 Установка зависимостей (npm install)...${NC}"
npm install || { echo -e "${RED}❌ Ошибка при установке пакетов.${NC}"; exit 1; }

echo ""
echo -e "${YELLOW}⬇️ Сборка хост-среды: клонирование Code-OSS...${NC}"
npm run vscode:clone || { echo -e "${RED}❌ Ошибка при клонировании Code-OSS.${NC}"; exit 1; }

echo ""
echo -e "${YELLOW}🔧 Применение патчей Nexus (VFS и отключение телеметрии)...${NC}"
npm run patch:apply || { echo -e "${RED}❌ Ошибка при применении патчей.${NC}"; exit 1; }

echo ""
echo -e "${YELLOW}⚙️ Проверка файла .env...${NC}"
if [ ! -f .env ]; then
    echo "ANTHROPIC_API_KEY=your_api_key_here" > .env
    echo -e "${GREEN}✅ Создан шаблон файла .env. Не забудьте добавить туда ваш API-ключ!${NC}"
else
    echo -e "${GREEN}✅ Файл .env уже существует.${NC}"
fi

echo ""
echo -e "${YELLOW}🧪 Запуск тестов (Sanity Check)...${NC}"
npm test || { echo -e "${RED}❌ Тесты не прошли! Проверьте логи перед запуском IDE.${NC}"; exit 1; }

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}🎉 Установка успешно завершена!${NC}"
echo -e "Теперь добавьте свой ключ в файл .env и запустите IDE командами:"
echo -e "  ${YELLOW}npm run build${NC}"
echo -e "  ${YELLOW}npm run dev${NC}"
echo -e "${GREEN}==========================================${NC}"