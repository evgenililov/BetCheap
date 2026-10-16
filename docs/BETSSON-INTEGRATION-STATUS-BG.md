# Betsson — подготовка за ISA v1.10

Проверени са предоставените B2C_Affiliate_API_v1.10 (1).pdf и BGA_Sportsbook_Link_Router_Doc.pdf. Потребителят потвърди, че разполага само с документацията, без OCB и одобрен статичен изходящ IP. Публичната Netlify проверка показа липсващи настройки и HTTP 503 от Betsson events функцията.

## Готово в този клон

- Бутон към съществуващия партньорски линк през фиксиран server-side маршрут; браузърът не може да замени адреса.
- ISA диагностиката обработва описаните event/market/selection полета, страници и fixtureTags. Заявките са ограничени до футбол.
- Разграничени грешки за отказан достъп и ограничение на заявките; OCB и gateway token не се връщат към браузъра.
- Непознатите числови статуси не се приемат за активни оферти. Диагностиката показва наличието на цена, но не я обявява за проверен коефициент.
- 21 тестови файла и синтактичната проверка минаха. API тестовете са с контролирани отговори, не с реален Betsson достъп.

## Остава за активиране на сравнение

1. Betsson да издаде OCB и да потвърди segment ID за акаунта и пазара.
2. Да се осигури статичен изходящ IP и Betsson да го добави в whitelist. Обикновена Netlify Function не е доказателство за фиксиран изходящ IP. Текущият код очаква HTTPS gateway със статичен изход; такъв още не е внедрен.
3. Да се получат значенията на market status msi, selection status si, settled status ssi и пазарните/селекционните template IDs. PDF изброява полетата, но не дефинира статусите; за пълния списък шаблони препраща към affiliate екипа.
4. Да се провери реален отговор, да се довърши съпоставянето на събития и еднакви пазари и да се добави трета колона в сравнението.
5. Да се потвърди текущият brand/language router URL. По-новият API v1.10 описва eventId/marketId/selectionId; отделният router PDF съдържа по-стар формат. Нито един примерен линк или segment ID не се приема за конфигурация на потребителя.

Няма внедряване в Netlify, активни Betsson коефициенти или проверено партньорско отчитане. Бутонът отваря запазения партньорски адрес, без предварително попълнен залог. Оригиналните PDF документи не се публикуват в Git.

## Текст за affiliate manager / support

Hello, we operate BetCheap (https://betcheap.netlify.app/), an odds comparison website. We have received the B2C Affiliate API v1.10 and Sportsbook Link Router documentation, but have not received production API credentials or IP whitelist approval.

Please enable ISA odds feed access for our affiliate account and confirm:
- How to obtain our OCB securely and which segment ID we should use.
- The process for whitelisting our static outbound IP. Our frontend runs on Netlify; we will arrange a static-egress backend/gateway.
- The market and selection template catalogue, including periods, line settlement rules, and the meaning of msi, si and ssi status values.
- Rate limits, permitted caching and pre-match/live coverage.
- The current Betsson router URL and whether our existing affiliate tracking link supports the documented deeplink parameter.

We need access to display real odds alongside other bookmakers and route clicks through our affiliate link. Please confirm that this use is supported for our account and target market.
