# BetCheap v2.45.3 — Cloudbet cutoffTime

## Установена причина

След публикуването на 2.45.2 реалната заявка за Everton–Chelsea, 17.10.2026 11:30 UTC, върна:

```json
{"eventsSeen":23,"eventsWithTeamNames":20,"eventsWithStartTime":0,"sameTeams":1,"sameTeamsAndTime":0,"sameTeamsAndStatus":1,"matchFailure":"start_time_mismatch"}
```

Отборите и статусът са намерени. Времевата проверка се проваля, защото кодът чете само `startTime`.

Официалната Cloudbet Feed схема дефинира `cutoff_time` за EventForCompetition, FixtureListEntry и Event. Според README доставчикът използва Go protojson, който сериализира това поле като `cutoffTime`. Старите примерни отговори съдържат и `startTime`; текущата protobuf схема не го дефинира.

Проверени източници:

- https://github.com/cloudbet/docs/blob/c3024e079db1d64684f742fbf7e26663aa3d8d36/cloudbet/feed.proto
- https://github.com/cloudbet/docs/blob/c3024e079db1d64684f742fbf7e26663aa3d8d36/README.md
- https://github.com/cloudbet/docs/blob/c3024e079db1d64684f742fbf7e26663aa3d8d36/api-responses.md

## Поправка

`eventClock` чете RFC3339 времето от `startTime` или документирaното `cutoffTime`. При налични валидни, но противоречащи си времена с разлика над 15 минути отказва съпоставянето.

Полето cutoffTime е операторско време за cutoff, не безусловно доказателство за kickoff. То се използва за съпоставяне само когато е до 15 минути от началния час, подаден от 1xBet, и изпълнява съществуващите pre-match/LIVE времеви ограничения. Имената, ролите домакин/гост и статусът също остават задължителни.

Една и съща проверка се прилага в списъка с мачове, в отделния event detail и при fallback заявката за пазара. Успешният отговор връща `start` и `timeSource`, за да се вижда използваното поле. Диагностиката вече брои и `eventsWithCutoffTime` и `eventsWithUsableTime`.

## Валидиране

- `npm test`: 11 тестови файла успешни.
- `npm run check`: успешна проверка на JavaScript синтаксиса.
- Нови регресии: текущият cutoffTime формат, съвместимост със стария startTime, невалидни/противоречащи си времена, pre-match и LIVE HTTP сравнение, fallback за същия мач и отказ при различен час в event detail.
- Автоматизираните операторски отговори в тези тестове са фикстури и не доказват реална едновременна наличност на двата пазара.

## След качване

Публикувай целия пакет в съществуващия Netlify проект, включително актуализираните `netlify/lib/cloudbet-compare.js` и `netlify/functions/cloudbet.js`. Запази работещите API настройки.

След това повтори сравнението за реална предстояща среща. При намерен пазар се очакват `matched:true`, три действителни цени, `start` и `timeSource`. При непълен или спрян пазар втори коефициент няма да се измисля; диагностиката остава активна. LIVE проверката трябва да използва актуално играещ мач.

Тази версия поправя установеното несъответствие със схемата. Реалното сравнение с поправения backend предстои след deploy. Операторските и affiliate линковете не са променяни. От тази среда не е стартиран Netlify deploy.
