# BetCheap v2.44 — диагностична интеграционна версия (НЕ качвайте преди преглед)

Дата: 2026-10-16. Източник: последният запазен кодов пакет v2.43 от Library.

## Направени промени
1. `netlify/functions/cloudbet.js`: публичният `?op=probe` вече проверява **до 3** отделни реални събития в паралел, вместо да прави генерално заключение от първото. Връща само обобщени числа, и евентуално безопасни имена на пазарните ключове (`soccer.*`), без Event IDs, API ключове и raw provider payload.
2. При недостъпен пазар в пълния event detail, `op=compare` прави втори опит за **същия и вече проверен Event ID** с документирания `markets=soccer.matchOdds`. Всеки отговор отново се сверява по ID, отбори, старт и LIVE/PREMATCH. При HTTP 400 във fallback пазара се запазва честният резултат `full_time_1x2_unavailable` вместо фалшива цена.
3. Нови регресионни тестове за диагностиката, забрана на кръстосване на срещи, fallback при live и непълни/спрени пазари.

## Реално проверено на 16.10.2026
- Production `cloudbet?op=probe` във v2.43: `ok:true`, `authenticated:true`, `competitionFound:true`, `eventsReturned:23`, `individualEvent1x2Available:false`. Това не потвърждава никакви реални Cloudbet 1X2 цени.
- Production `cloudbet?op=status`: `configured:true`.
- Production 1xBet `onexbet?op=sports&kind=live`: HTTP API връща `ok:true`, `count:19` спортни ID.
- Нов v2.44: 13/13 автоматизирани Node тестове, проверка `node --check` и ZIP CRC тест.

## НЕ е потвърдено
- Двата оператора все още НЕ са доказали едновременно реални съпоставими 1X2 коефициенти за един мач в Production.
- Визуално/интерактивно преминаване на всички бутони в реален браузър; локалният Chromium блокира `localhost` и `file://` административно.
- Cloudbet LIVE 1X2 за реална среща и 60s свежест; операторският affiliate feed може да изостава.
- GEO законност, партньорски event/selection deeplink и dashboard атрибуция към 1xBet и Cloudbet. Не се активира автоматично пренасочване.
- Netlify deploy на v2.44 не е извършен.

## Какво да се направи при продължение
1. Използвай този архив като актуален кодов проект; не започвай от v2.41/v2.40.
2. При следващ единичен общ Netlify deploy провери `/.netlify/functions/cloudbet?op=probe`: `diagnostics.checked`, `diagnostics.complete1x2`, `diagnostics.marketKeySamples`, грешки `stage` без API ключ. При липса на ценови пазари не показвай втори оператор с празни/демо коефициенти.
3. Ако диагностиката все още не намира 1X2, провери през официалния Cloudbet API portal с авторизирания Affiliate API Key само за твоите допустими права, или поискайте пример за tradable event и структура на пазара от Cloudbet. Не изпращай ключове в чат.
4. След това провери един и същи реален pre-match мач и един действителен LIVE мач, идентични период/изходи, цени и времеви печати; провери age gate, OCR, share, alerts, LIVE refresh, операторските модали в реален browser.
5. Отделно потвърди партньорското отчитане, GEO и операторските deep links. Не отключвай защитите само за да се вижда активен бутон.

## Разгръщане
Netlify Drop: качи ZIP с `index.html`, `netlify.toml`, `assets/` и `netlify/functions/` в корена. Скритите ключове остават само в Netlify `Environment Variables`; този архив НЕ съдържа реални API токени.

Цел: един общ deploy при генерална промяна; текущият пакет е preflight, не заявка за незабавно публикуване.
