# MedPredict frontend

React + TypeScript + Vite. Java/Spring Boot backend находится в отдельном репозитории MedPredicts/backend, а ML pipeline — в MedPredicts/ml.

- `npm ci`, `npm run dev` — установка и локальный запуск (127.0.0.1:5173).
- `npm run dev` использует HTTP API через Vite proxy на 127.0.0.1:8080; `npm run dev:demo` — автономный фиксированный пример.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — проверки.
- `npm run test:e2e` — Chromium, два временных Vite-сервера на 4173/4174; при отсутствии браузера `npx playwright install chromium`.
- `npm run test:integration` — Chromium desktop/mobile с настоящим backend в профиле demo на 8080; временный frontend на 5173. Инструкции и ограничения: `docs/integration.md`.
- `npm run test:integration:model` — Chromium desktop/mobile с настоящим backend в профиле onnx на 8081; отдельный временный frontend на 5175. Backend требует `MEDPREDICT_MODEL_DIRECTORY` с артефактами из MedPredicts/ml и origin 5175 в CORS allowlist; другой target задаётся `API_PROXY_TARGET`.
- `src/pages/HomePage.tsx` — landing из ветки `figma-design`; `PredictionPage.tsx` — форма на `#/predict`. `src/components` — общий header/footer, поля и результат; `src/hooks/usePrediction.ts` — состояние сценария и отмена. Hash-навигация через `useNavigation` сохраняет значения формы и отменяет активный запрос при уходе.
- `src/config` — предварительный показатель и конфигурация окружения; `src/i18n/ru.ts` — тексты; `src/api` — типизированные адаптеры и проверки ответов; `src/validation.ts` — преобразование ввода.
- Медицинские диапазоны берутся только из согласованной конфигурации сервера. Демо — фиксированный пример, без медицинской формулы и без автоматического перехода из real.
- Модель САД оценивает текущее измеряемое давление, не фактическое измерение пациента и не прогноз будущего давления. `glucose` — глюкоза плазмы натощак в ммоль/л. Сохранять ограничения исследовательского применения, отсутствие клинической сертификации/валидации для Казахстана и запрет изменения лечения по результату.
- Не сохранять показатели в localStorage/sessionStorage, аналитике или логах. Браузерные тесты используют только синтетические примеры.
- Сохранять связь ошибок с полями, клавиатурный фокус и защиту от устаревших ответов.
- Контракт GET/POST реализован в MedPredicts/backend: `docs/api-contract.md`. Менять его вместе с тестами и документацией после согласования с Оралханом. `predictionType` и `demo` — необязательные строго проверяемые поля; legacy `demo-example` остаётся маркированным demo. HTTP-режим real не подтверждает готовность ML: backend имеет отдельные профили demo/onnx и MODEL_UNAVAILABLE без готового провайдера.
