# NOCTURNE shop — сайт + админка + Telegram-бот

1. @BotFather → /newbot → получи BOT_TOKEN. Свой Telegram ID узнай у @userinfobot.
2. GitHub: залей эту папку в новый репозиторий. Vercel → Add New Project → импортируй репозиторий.
3. Vercel → Storage → добавь Upstash Redis (Marketplace). Он сам создаст UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN.
4. Vercel → Settings → Environment Variables:
   BOT_TOKEN, ADMIN_IDS (твои ID через запятую), ADMIN_PASSWORD (для /admin.html),
   WEBHOOK_SECRET (любая длинная строка из букв и цифр), MANAGER (ник менеджера без @)
5. Redeploy. Затем открой в браузере один раз (подставь свои значения):
   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<твой-сайт>.vercel.app/api/bot&secret_token=<WEBHOOK_SECRET>
6. В public/index.html вверху скрипта поставь TG и BOT (ники без @). Закоммить.

Бот: /start (каталог, корзина, заказ), /admin (товары, остатки, цены, заказы, статистика, /add, /send).
Сайт: кнопка «Заказать» открывает бота сразу на нужном товаре. Админка: https://<сайт>/admin.html
