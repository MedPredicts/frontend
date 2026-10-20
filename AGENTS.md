# MedPredict frontend

React + TypeScript + Vite. Репозиторий содержит только часть Бөгенбаева Саната; сервер Java/Spring Boot и модель создают другие участники.

- `npm ci`, `npm run dev` — установка и локальный запуск (127.0.0.1:5173).
- `npm run dev` использует HTTP API через Vite proxy на 127.0.0.1:8080; `npm run dev:demo` — автономный фиксированный пример.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — проверки.
- `npm run test:e2e` — Chromium, два временных Vite-сервера на 4173/4174; при отсутствии браузера `npx playwright install chromium`.
- `npm run test:integration` — Chromium desktop/mobile с настоящим backend в профиле demo на 8080; временный frontend на 5173. Инструкции и ограничения: `docs/integration.md`.
- `src/pages` — экран; `src/components` — поля и результат; `src/hooks/usePrediction.ts` — состояние сценария и отмена.
- `src/config` — предварительный показатель и конфигурация окружения; `src/i18n/ru.ts` — тексты; `src/api` — типизированные адаптеры и проверки ответов; `src/validation.ts` — преобразование ввода.
- Медицинские диапазоны берутся только из согласованной конфигурации сервера. Демо — фиксированный пример, без медицинской формулы и без автоматического перехода из real.
- Не сохранять показатели в localStorage/sessionStorage, аналитике или логах. Браузерные тесты используют только синтетические примеры.
- Сохранять связь ошибок с полями, клавиатурный фокус и защиту от устаревших ответов.
- Контракт GET/POST реализован в MedPredicts/backend: `docs/api-contract.md`. Менять его вместе с тестами и документацией после согласования с Оралханом. HTTP-режим real не означает наличие обученной модели: текущий backend имеет demo и MODEL_UNAVAILABLE.
