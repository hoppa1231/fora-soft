# Implementation Plan

Источники:

- PRD: `artifacts/prd-video-chat-room.md`
- TDD: `prds/video-chat-room/design-video-chat-room.md`

- [ ] 1. Инициализировать структуру проекта
  - Создать базовую структуру `client/` и `server/` согласно TDD.
  - Настроить package scripts для разработки, тестов и сборки.
  - Добавить базовый `.gitignore` и переменные окружения для URL клиента/сервера.
  - _Requirements: PRD §7 stack constraints; Design: 2, 12_

- [ ] 2. Поднять базовый Node.js + Socket.io сервер
  - Создать HTTP server и Socket.io endpoint.
  - Настроить CORS для dev-окружения.
  - Добавить базовый health endpoint для smoke-check, если выбран HTTP server с Express/Fastify.
  - _Dependencies: после 1_
  - _Requirements: F-04, F-35; Design: 3, 4, 6, 12_

- [ ] 3. Реализовать серверную валидацию и нормализацию пользовательского ввода
  - Валидировать `displayName`: trim, 1-30 символов, допустимые символы.
  - Валидировать `roomId`: URL-safe строка.
  - Валидировать chat message: trim, непустое, лимит длины.
  - Возвращать структурированные ошибки `VALIDATION_ERROR`.
  - _Dependencies: после 2_
  - _Requirements: F-01, FR-24, FR-38, FR-39, FR-40; Design: 5, 6, 8, 10_

- [ ] 4. Реализовать in-memory `roomStore`
  - Добавить `RoomState`, `ParticipantState`, `ChatMessage`.
  - Реализовать создание комнаты при первом входе.
  - Реализовать хранение участников и истории сообщений в памяти.
  - Реализовать удаление комнаты после выхода последнего участника.
  - _Dependencies: после 3_
  - _Requirements: FR-05, FR-09, F-14, F-17, F-18; Design: 4, 5, 7_

- [ ] 5. Реализовать атомарный вход в комнату и лимит 4 участников
  - Обработать `join-room` с ack-ответом.
  - Синхронно проверять `participants.size < 4` перед добавлением участника.
  - Для 5-го участника возвращать `ROOM_FULL`.
  - Допускать одинаковые отображаемые имена и несколько вкладок одного пользователя.
  - _Dependencies: после 4_
  - _Requirements: F-04, F-05, FR-05, FR-07, FR-08, FR-29, FR-30, FR-32; Design: 3, 4, 6, 8_

- [ ] 6. Реализовать серверный lifecycle выхода и disconnect
  - Обработать `leave-room`.
  - Обработать Socket.io `disconnect` как выход участника.
  - Освобождать слот, удалять participant, удалять пустую комнату.
  - Не реализовывать auto-reconnect.
  - _Dependencies: после 5_
  - _Requirements: FR-09, F-17, F-18, FR-28, FR-31; Design: 4, 5, 7, 8_

- [ ] 7. Реализовать серверные системные события участников
  - Рассылать `participant-joined`, `participant-left`, `participants-updated`.
  - Добавлять системные сообщения о входе и выходе в историю комнаты.
  - Использовать формулировку выхода без текста «соединение потеряно».
  - _Dependencies: после 6_
  - _Requirements: F-15, F-16, F-17, F-18; Design: 4, 6, 7_

- [ ] 8. Реализовать серверный текстовый чат
  - Обработать `chat-message`.
  - Сохранять сообщения в истории комнаты на время жизни комнаты.
  - Рассылать сообщения всем участникам комнаты.
  - Ограничить историю разумным in-memory лимитом.
  - _Dependencies: после 5_
  - _Requirements: F-12, F-13, F-14, FR-24, FR-39, FR-40; Design: 5, 6, 8, 9, 10_

- [ ] 9. Реализовать маршрутизацию WebRTC signaling на сервере
  - Обработать `signal` для типов `offer`, `answer`, `ice-candidate`.
  - Проверять, что sender находится в комнате.
  - Доставлять signaling только адресату `to`.
  - Возвращать/игнорировать `TARGET_NOT_FOUND`, если адресат уже вышел.
  - _Dependencies: после 5_
  - _Requirements: F-06, F-18; Design: 3, 4, 6, 7, 8_

- [ ] 10. Реализовать серверное обновление media-state
  - Обработать `media-state` для `audioEnabled` и `videoEnabled`.
  - Обновлять состояние участника в `roomStore`.
  - Рассылать актуальный список участников.
  - _Dependencies: после 5_
  - _Requirements: F-09, F-10, FR-16, FR-18; Design: 4, 5, 6, 7_

- [ ] 11. Инициализировать React-приложение и маршрутизацию
  - Настроить стартовую страницу и route комнаты `/room/:roomId` или эквивалент.
  - Обеспечить переход после создания комнаты.
  - Не сохранять имя или состояние в localStorage.
  - _Dependencies: после 1_
  - _Requirements: F-01, F-02, F-04, Non-Goals client persistence; Design: 2, 4, 12_

- [ ] 12. Реализовать стартовый экран и валидацию имени на клиенте
  - Добавить поле имени и кнопку «Создать комнату».
  - Блокировать пустое имя.
  - Ограничить имя 30 символами и допустимыми символами.
  - Показывать понятные ошибки на русском.
  - _Dependencies: после 11_
  - _Requirements: F-01, FR-38, FR-39; Design: 4, 8, 10_

- [ ] 13. Реализовать создание комнаты и вход по ссылке на клиенте
  - Генерировать URL-safe `roomId` при создании комнаты.
  - Считывать `roomId` из URL при входе по ссылке.
  - Отправлять `join-room` после ввода имени.
  - Обрабатывать создание новой комнаты по несуществующему идентификатору как штатный вход.
  - _Dependencies: после 12 и 5_
  - _Requirements: F-02, F-04, FR-05, FR-06; Design: 3, 6, 7_

- [ ] 14. Реализовать `useSocketRoom`
  - Инкапсулировать подключение Socket.io.
  - Поддержать состояния `connecting`, `joined`, `room-full`, `server-error`.
  - Подписаться на события participants/chat/signaling.
  - Выполнять cleanup listeners при выходе со страницы.
  - _Dependencies: после 13, 7, 8, 9, 10_
  - _Requirements: F-04, F-05, F-12, F-16, F-18, F-35; Design: 4, 6, 8_

- [ ] 15. Реализовать `useLocalMedia`
  - Проверять поддержку WebRTC и `getUserMedia`.
  - Запрашивать аудио и видео при входе.
  - Разрешать вход без устройств или при отказе permissions.
  - Отслеживать `track.onended` для потери устройства.
  - _Dependencies: после 14_
  - _Requirements: F-06, FR-13, FR-14, FR-20, FR-33, FR-36; Design: 4, 7, 8_

- [ ] 16. Реализовать управление микрофоном
  - Добавить toggle микрофона через `audioTrack.enabled`.
  - Отправлять `media-state` после изменения.
  - Отображать локальное и удалённое muted-состояние.
  - _Dependencies: после 15 и 10_
  - _Requirements: F-09, FR-16; Design: 4, 6, 7, 8_

- [ ] 17. Реализовать управление камерой с освобождением устройства
  - Выключать камеру через `videoTrack.stop()`.
  - Выполнять `replaceTrack(null)` для всех peer connections.
  - Включать камеру повторным `getUserMedia({ video: true })`.
  - Отправлять `media-state` после изменения.
  - _Dependencies: после 15, 16 и 10_
  - _Requirements: F-10, FR-18, FR-19, FR-20; Design: 4, 7, 8, 13_

- [ ] 18. Реализовать `usePeerConnections`
  - Хранить `Map<participantId, RTCPeerConnection>`.
  - Настроить ICE servers с `stun:stun.l.google.com:19302`.
  - Добавлять локальные tracks в peer connection.
  - Закрывать peer connection при выходе участника.
  - _Dependencies: после 15 и 9_
  - _Requirements: F-06, F-18, FR-34; Design: 3, 4, 7, 8, 9_

- [ ] 19. Реализовать WebRTC offer/answer flow для нового участника
  - Новый участник создаёт offer ко всем существующим участникам.
  - Существующие участники отвечают answer.
  - Обменивать ICE candidates через Socket.io.
  - Обрабатывать `connectionState`/`iceConnectionState` failures без падения комнаты.
  - _Dependencies: после 18_
  - _Requirements: F-06, F-18, FR-34; Design: 3, 6, 7, 8_

- [ ] 20. Реализовать экран комнаты и базовый layout
  - Собрать `RoomPage` из видео, controls, чата и списка участников.
  - Сделать desktop layout от 1024px.
  - Отображать состояния загрузки, ошибки сервера и отсутствия WebRTC.
  - _Dependencies: после 14, 15, 18_
  - _Requirements: F-07, F-16, F-35, FR-36; Design: 4, 8_

- [ ] 21. Реализовать видеосетку и плитку участника
  - Отображать 1-4 плитки в адаптивной сетке.
  - Показывать self-view и remote streams.
  - Показывать имя участника поверх плитки.
  - Показывать заглушку при отсутствии видео.
  - Показывать иконку выключенного микрофона.
  - _Dependencies: после 20_
  - _Requirements: F-07, F-08, FR-16, FR-18, FR-33; Design: 4, 7, 8_

- [ ] 22. Реализовать панель управления комнатой
  - Добавить кнопки микрофона, камеры, копирования ссылки и выхода.
  - Показывать подтверждение копирования ссылки.
  - По выходу останавливать local media, закрывать peers и отправлять `leave-room`.
  - _Dependencies: после 16, 17, 20_
  - _Requirements: F-03, F-09, F-10, F-17; Design: 4, 7, 8_

- [ ] 23. Реализовать чат на клиенте
  - Отображать user/system сообщения.
  - Показывать имя отправителя и локальное время `HH:MM`.
  - Блокировать пустые сообщения.
  - Автоматически прокручивать чат к последнему сообщению.
  - Отображать историю сообщений после входа.
  - _Dependencies: после 8 и 14_
  - _Requirements: F-12, F-13, F-14, F-15, FR-24, FR-39; Design: 4, 5, 6, 7, 8, 10_

- [ ] 24. Реализовать список участников
  - Отображать актуальный список участников комнаты.
  - Обновлять список по `participants-updated`.
  - Не показывать внутренние participant/socket IDs в UI.
  - _Dependencies: после 7 и 14_
  - _Requirements: F-16, FR-30; Design: 4, 5, 6_

- [ ] 25. Реализовать обработку заполненной комнаты и повтор входа
  - Обработать `ROOM_FULL` на клиенте.
  - Показать сообщение «Комната заполнена».
  - Добавить кнопку повторить вход без перезагрузки приложения.
  - _Dependencies: после 5 и 14_
  - _Requirements: F-05, FR-08; Design: 6, 8_

- [ ] 26. Реализовать UX для permission, autoplay и media errors
  - Показать сообщение при отказе камеры/микрофона.
  - Показать кнопку «Включить звук» при autoplay block.
  - Показать понятную ошибку при отсутствии WebRTC.
  - Показать статус проблемного peer при ICE failure, не ломая чат.
  - _Dependencies: после 15, 19, 20_
  - _Requirements: FR-33, FR-34, F-35, FR-36, FR-37; Design: 8, 10, 13_

- [ ] 27. Покрыть сервер unit tests
  - Протестировать validation и sanitize.
  - Протестировать `roomStore`: создание, лимит 4, отказ 5-му, удаление последнего.
  - Протестировать системные сообщения и историю чата.
  - _Dependencies: после 3, 4, 5, 6, 8_
  - _Requirements: F-01, F-05, F-12, F-14, F-17, F-18, FR-38, FR-39; Design: 11_

- [ ] 28. Покрыть Socket.io integration tests
  - Проверить `join-room` для новой/существующей/заполненной комнаты.
  - Проверить chat flow и историю для позднего участника.
  - Проверить маршрутизацию `offer`/`answer`/`ice-candidate`.
  - Проверить cleanup после `disconnect`.
  - _Dependencies: после 7, 8, 9, 10_
  - _Requirements: F-04, F-05, F-06, F-12, F-14, F-16, F-18; Design: 6, 7, 11_

- [ ] 29. Покрыть клиентские unit tests
  - Протестировать validation utils.
  - Протестировать UI states стартовой формы.
  - Протестировать reducers/state helpers для participants/chat, если они выделены.
  - Замокать Socket.io и WebRTC API для hooks smoke-tests.
  - _Dependencies: после 12, 14, 15, 23, 24_
  - _Requirements: F-01, F-12, F-16, FR-24, FR-36, FR-38; Design: 11_

- [ ] 30. Добавить Playwright E2E smoke tests
  - Проверить создание комнаты и вход второго участника.
  - Проверить копирование ссылки.
  - Проверить отправку сообщения.
  - Проверить отказ пятому участнику.
  - Проверить выход участника и обновление UI у остальных.
  - _Dependencies: после 20-25_
  - _Requirements: F-02, F-03, F-04, F-05, F-12, F-16, F-17; Design: 11_

- [ ] 31. Добавить E2E/ручные проверки медиа-сценариев
  - Проверить выключение микрофона и UI-индикацию.
  - Проверить выключение камеры с физическим освобождением устройства.
  - Проверить отказ permissions в браузере.
  - Проверить отсутствие WebRTC/getUserMedia mock-сценарием.
  - _Dependencies: после 16, 17, 21, 26_
  - _Requirements: F-06, F-09, F-10, FR-19, FR-33, FR-36; Design: 11, 13_

- [ ] 32. Подготовить production build и запуск
  - Настроить сборку React SPA.
  - Настроить серверную отдачу static build или документировать раздельный deploy.
  - Проверить Socket.io WebSocket upgrade за proxy.
  - Зафиксировать требование HTTPS вне `localhost`.
  - _Dependencies: после 1, 2, 11_
  - _Requirements: F-35, PRD §7 HTTPS; Design: 10, 12_

- [ ] 33. Добавить README с запуском и QA checklist
  - Описать dev-запуск клиента и сервера.
  - Описать production build.
  - Описать ручной QA для 2-4 участников, чата, камеры, микрофона, room full.
  - Зафиксировать ограничения: mesh до 4, без TURN, без персистентности.
  - _Dependencies: после 30, 31, 32_
  - _Requirements: PRD §5 Non-Goals, PRD §7 Technical Considerations; Design: 9, 12, 13_
