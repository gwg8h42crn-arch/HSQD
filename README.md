# NIGHT DROP — сайт + админка + Telegram-бот
Все файлы заменить в репозитории (папки api и public). Переменные в Vercel те же.
Сайт: public/index.html — вверху скрипта впиши BOT и MGR (ники без @).
Админка: /admin.html. Бот: /admin.

## Напоминания (cron)
Добавь переменную CRON_SECRET (любая длинная строка). Затем на cron-job.org создай задачу:
URL: https://<сайт>/api/cron?key=<CRON_SECRET>, каждые 5 минут.
