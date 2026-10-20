<p align="center">
  <img src="public/logo.png" alt="MedPredict" width="420" />
</p>

# MedPredict frontend

Медициналық көрсеткіштерді болжауға арналған оқу жобасының фронтенді. React + TypeScript + Vite, қазақша / русский / English интерфейсі, деректерді тексеру, API адаптері және PDF экспорты.

Бұл — бір беттік интерфейс, [MedPredicts/backend](https://github.com/MedPredicts/backend) серверімен HTTP арқылы біріктірілген. Figma арқылы жасалған кеңейтілген интерфейс кейін бөлек қосылады. Сервердің demo профилі тұрақты мысал қайтарады; үйретілген модель әлі қосылмаған. Толық іске қосу нұсқаулығы мен қалған міндеттер: [интеграция есебі](docs/integration.md).

## Іске қосу

Node.js 22.12+ және npm қажет.

```sh
git clone https://github.com/MedPredicts/frontend.git
cd frontend
npm ci
npm run dev
```

Алдымен backend репозиторийінде серверді іске қосыңыз:

```sh
bash ./mvnw spring-boot:run -Dspring-boot.run.profiles=demo
```

JDK 17+ қажет. Backend адресі — http://127.0.0.1:8080, frontend адресі — http://127.0.0.1:5173. `.env.development` HTTP режимін пайдаланады; Vite `/api` сұрауларын backend серверіне жібереді. Сервердің demo нәтижесі — деректерге тәуелсіз тұрақты `134,2` мысалы; ол интерфейс пен PDF ішінде белгіленеді. Backend demo профилінсіз `503 MODEL_UNAVAILABLE` қайтарады.

## Автономды demo

Backend серверінсіз іске қосу немесе demo жинағын дайындау:

```sh
npm run dev:demo
# Немесе:
npm run build:demo
npm run preview
```

Жинақталған demo серверге болжам сұрауларын жібермейді. Нәтиже — енгізілген деректерге тәуелсіз, бекітілген мысал. Demo сценарийлері: `success`, `validation`, `unavailable`.

## API интеграциясы

`GET /api/v1/model/info` және `POST /api/v1/predictions` Spring Boot серверімен тексерілген. Форма сервер metadata-сына сәйкес құрылады; қателер таңдалған тілмен `Accept-Language` арқылы сұралады. Сервер валидациясы, timeout, сұраудан бас тарту және қайталау өңделеді. Толық форматтар: [API контракты](docs/api-contract.md).

`npm run build` HTTP нұсқасын жинайды. Production ортасында `/api` үшін backend reverse proxy баптаңыз немесе `VITE_API_BASE_URL` HTTPS адресін беріп, backend `CORS_ALLOWED_ORIGINS` тізіміне сайт origin-ын қосыңыз. Үйретілген модель, preprocessing және нақты модельдің тексеру мысалдары әлі қажет.

`.env.example` — жергілікті баптау үлгісі. `VITE_*` айнымалылары браузерге беріледі, оларға құпия деректерді жазбаңыз. Real режиміндегі қате demo режиміне автоматты ауыстырмайды.

## Тексерулер

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
# Backend demo 8080 портында жұмыс істеуі керек:
npm run test:integration
```

E2E тесттері синтетикалық мысалдар мен API жауаптарын алмастыруды пайдаланады. Серверлердің порттары — 4173 және 4174. `test:integration` нақты Spring Boot серверімен desktop/mobile тексерулерін орындайды: metadata → форма → POST → белгіленген нәтиже → PDF; сервер қатесі мен сәтті қайталау да тексеріледі. Frontend порты — 5173.

## Құрылым

- `src/` — бет, компоненттер, енгізуді тексеру, API, аудармалар және PDF.
- `public/` — логотиптер, жалаушалар және жергілікті қаріптер.
- `tests/` — Playwright сценарийлері.
- `docs/api-contract.md` — іске асырылған API контракты.
- `docs/integration.md` — іске қосу, тексеру нәтижелері және қалған міндеттер.
- `docs/design/icons.md` — түстер, иконкалар және ресурстардың дереккөздері.

Көрсеткіштер тек ағымдағы React күйінде сақталады; `localStorage`, `sessionStorage`, аналитика немесе фронтенд логтарына жазылмайды. PDF пайдаланушы экспорттаған деректерді қамтиды.

Noto Sans қарпі [OFL лицензиясымен](public/fonts/OFL.txt) таратылады. Иконкалар — [Flaticon Uicons](docs/design/icons.md).
