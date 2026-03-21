# План действий: Отчеты о ставках для нового парсера

## Цель
Добавить отправку отчетов о результатах ставок в таблицу Reports, **только если URL парсера является новым** (содержит `/new/`). Старая логика должна работать без изменений.

## Важные ограничения
1. **Изменения ТОЛЬКО в background.js** - не трогать bcgame.js и другие файлы
2. **Каждая очередь отдельная** - `http://bcp.bet/new/abb_pairs_pre_fortune/` и `http://bcp.bet/new/abb_pairs_pre_fonbet/` это разные очереди с разными bet_id
3. **URL парсера в settings** - параметр `linkToParser` находится в `bbSettings` в `background.js`
4. **Полная обратная совместимость** - если URL парсера старый, ничего не меняется

## Принципы
1. **Полная обратная совместимость** - если URL парсера старый, ничего не меняется
2. **Условная логика** - все новые изменения проверяют, является ли URL новым
3. **Изоляция изменений** - новые функции не затрагивают существующий код
4. **Только background.js** - все изменения изолированы в одном файле

---

## Детальный план изменений

### 1. Определение нового URL парсера

**Место:** `background.js` - добавить вспомогательную функцию

**Код:**
```javascript
// ⭐ НОВАЯ ФУНКЦИЯ: Проверка, является ли URL парсера новым
_isNewParserUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }
    // Проверяем, содержит ли URL '/new/' (новый парсер с очередью)
    return url.indexOf('/new/') > -1;
}
```

**Где добавить:** После метода `_transformFork()` (после строки 4395)

---

### 2. Сохранение bet_id при получении ставки из нового парсера

**Место:** `_getForkForStakeInit()` - после получения ставки (после строки 4501)

**Изменения:**
```javascript
// ⭐ ДОБАВИТЬ: После получения ставки из парсера
if (ok) {
    if (!!stakeFork.express) {
        pool.addBet(result);
        if (pool.isReady(enableFullLogs)) {
            // ⭐ ПРОВЕРКА: Если новый парсер - сохранить информацию о ставке
            const command = pool.getCommand();
            if (self._isNewParserUrl(stakeFork.link) && command.data && command.data[0]) {
                // Сохранить bet_id из ответа парсера (если есть)
                // bet_id уникален для каждого URL парсера
                if (current && current.bet_id) {
                    // bet_id уже есть в ответе парсера
                    self._currentParserBetId = current.bet_id;
                    self._currentParserUrl = stakeFork.link;
                    // Сохранить в команде для последующего использования
                    command.data[0]._parserBetId = current.bet_id;
                    command.data[0]._parserUrl = stakeFork.link;
                } else if (json && typeof json === 'object' && !Array.isArray(json) && json.bet_id) {
                    // Новый формат ответа: {status: 'success', data: {...}, bet_id: '...'}
                    self._currentParserBetId = json.bet_id;
                    self._currentParserUrl = stakeFork.link;
                    // Сохранить в команде для каждого элемента data
                    if (command.data && command.data.length > 0) {
                        command.data.forEach(bet => {
                            bet._parserBetId = json.bet_id;
                            bet._parserUrl = stakeFork.link;
                        });
                    }
                } else {
                    // Если bet_id нет в ответе, создать его на основе URL и данных ставки
                    // Это обеспечит уникальность для каждого URL
                    const betHash = self._generateBetIdForParser(stakeFork.link, current);
                    self._currentParserBetId = betHash;
                    self._currentParserUrl = stakeFork.link;
                    if (command.data && command.data.length > 0) {
                        command.data.forEach(bet => {
                            bet._parserBetId = betHash;
                            bet._parserUrl = stakeFork.link;
                        });
                    }
                }
            }
            self.proceedCommand(command);
        }
    } else {
        // ⭐ ПРОВЕРКА: Если новый парсер - сохранить информацию о ставке
        if (self._isNewParserUrl(stakeFork.link)) {
            // Сохранить bet_id из ответа парсера (если есть)
            if (current && current.bet_id) {
                self._currentParserBetId = current.bet_id;
                self._currentParserUrl = stakeFork.link;
                // Сохранить в result для последующего использования
                if (result.data && result.data.length > 0) {
                    result.data[0]._parserBetId = current.bet_id;
                    result.data[0]._parserUrl = stakeFork.link;
                }
            } else if (json && typeof json === 'object' && !Array.isArray(json) && json.bet_id) {
                // Новый формат ответа
                self._currentParserBetId = json.bet_id;
                self._currentParserUrl = stakeFork.link;
                if (result.data && result.data.length > 0) {
                    result.data[0]._parserBetId = json.bet_id;
                    result.data[0]._parserUrl = stakeFork.link;
                }
            } else {
                // Создать bet_id на основе URL и данных ставки
                const betHash = self._generateBetIdForParser(stakeFork.link, current);
                self._currentParserBetId = betHash;
                self._currentParserUrl = stakeFork.link;
                if (result.data && result.data.length > 0) {
                    result.data[0]._parserBetId = betHash;
                    result.data[0]._parserUrl = stakeFork.link;
                }
            }
        }
        self.proceedCommand(result);
    }
    return;
}
```

**Важно:** 
- Все проверки только для `self._isNewParserUrl(stakeFork.link)`
- bet_id уникален для каждого URL (включается URL в хеш)
- Сохраняется в `_parserBetId` и `_parserUrl` в данных команды

---

### 3. Модификация fetch запроса для нового парсера

**Место:** `_getForkForStakeInit()` - строка 4453 (fetch запрос)

**Изменения:**
```javascript
// ⭐ МОДИФИЦИРОВАТЬ: Добавить заголовок X-Client-Id только для нового парсера
const headers = {
    'Authorization': `Bearer ${self._settings[stakeFork.bookie + '_jwt']}`
};

// ⭐ ДОБАВИТЬ: Если новый парсер - добавить websocket_uid
if (self._isNewParserUrl(stakeFork.link)) {
    headers['X-Client-Id'] = self.s.websocket_uid;
    headers['Accept'] = 'application/json';
}

const response = await fetch(stakeFork.link, {
    headers: headers
})
```

**Важно:** Для старого парсера логика не меняется

---

### 4. Обработка нового формата ответа от парсера

**Место:** `_getForkForStakeInit()` - после дешифровки (после строки 4474)

**Изменения:**
```javascript
const respText = await this.somethingFunny(encryptedRespText);
let json = [];

try {
    const parsed = JSON.parse(respText);
    
    // ⭐ ДОБАВИТЬ: Проверка формата ответа для нового парсера
    if (self._isNewParserUrl(stakeFork.link) && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Новый формат с очередью: {status: 'success', data: [...], bet_id: '...'}
        if (parsed.status === 'rate_limited') {
            // Rate limited - обработать как обычно
            if (parsed.retry_after) {
                // Можно добавить логику для retry_after
            }
            json = [];
        } else if (parsed.status === 'success' && Array.isArray(parsed.data)) {
            // Успешный ответ с данными
            json = parsed.data;
            // bet_id будет в каждом элементе массива или в самом объекте
            if (parsed.bet_id) {
                self._currentParserBetId = parsed.bet_id;
            }
        } else if (parsed.status === 'no_data' || parsed.status === 'all_busy') {
            // Нет данных или все ставки заняты
            json = [];
        } else {
            // Неизвестный формат - попробовать как массив
            json = Array.isArray(parsed) ? parsed : [];
        }
    } else {
        // ⭐ СТАРЫЙ ФОРМАТ: Для старого парсера работаем как раньше
        json = Array.isArray(parsed) ? parsed : [];
    }
} catch (e) {
    dLog('red', 'Common', [`Error in JSON: ${e}, response:`, respText]);
}
```

**Важно:** Для старого парсера логика полностью сохраняется

---

### 5. Функция генерации bet_id с учетом URL

**Место:** `background.js` - добавить вспомогательную функцию

**Код:**
```javascript
// ⭐ НОВАЯ ФУНКЦИЯ: Генерация уникального bet_id на основе URL парсера и данных ставки
_generateBetIdForParser(parserUrl, betData) {
    if (!parserUrl || !betData) {
        return null;
    }
    // Создать уникальный ID на основе URL парсера и данных ставки
    // Это обеспечит, что каждый URL имеет свою очередь
    const dataToHash = {
        url: parserUrl,
        sport: betData.sport || betData.BK1_sport || betData.BK2_sport || '',
        league: betData.league || betData.BK1_league || betData.BK2_league || '',
        team1: betData.homeTeam || betData.BK1_game?.split(' vs ')[0] || '',
        team2: betData.awayTeam || betData.BK1_game?.split(' vs ')[1] || '',
        market: betData.bet_type || betData.BK1_bet_type || '',
        target: betData.bet || betData.BK1_bet || '',
        coef: betData.cf || betData.BK1_cf || betData.coef || ''
    };
    
    // Простой хеш на основе данных (можно использовать более сложный алгоритм)
    const dataString = JSON.stringify(dataToHash);
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
        const char = dataString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    // Включить URL в хеш для уникальности для каждого парсера
    const urlHash = parserUrl.split('/').join('').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    return `bet_${urlHash}_${Math.abs(hash).toString(36)}`;
}
```

**Где добавить:** После функции `_isNewParserUrl()` (после строки 4395)

---

### 6. Сохранение информации о ставке при постановке команды

**Место:** `proceedCommand()` - при обработке ставки (после строки 1589, перед отправкой команды)

**Изменения:**
```javascript
proceedCommand(command) {
    // ... существующий код до строки 1589 ...
    
    const self = this;
    const bk = this.extBkToInternal(command.bk);
    
    // ⭐ ДОБАВИТЬ: Сохранить информацию о ставке из нового парсера в currentCommand
    // Это нужно для того, чтобы потом в sendAnswer можно было получить доступ к parser URL и bet_id
    if (command.data && command.data[0] && command.data[0].betFromParser) {
        // Проверить, есть ли сохраненная информация о parser в данных команды
        if (command.data[0]._parserBetId && command.data[0]._parserUrl) {
            // Сохранить в currentCommand для последующего использования в sendAnswer
            // Когда bcgame.js вернет ответ, мы сможем получить эту информацию из currentCommand
            if (!this.command.currentCommand._parserInfo) {
                this.command.currentCommand._parserInfo = {};
            }
            // Сохранить для каждой ставки в команде
            command.data.forEach((bet, index) => {
                if (bet._parserBetId && bet._parserUrl) {
                    if (!this.command.currentCommand._parserInfo[bet._parserBetId]) {
                        this.command.currentCommand._parserInfo[bet._parserBetId] = {
                            parserUrl: bet._parserUrl,
                            parserBetId: bet._parserBetId,
                            betIndex: index
                        };
                    }
                }
            });
        }
    }
    
    // ... остальной существующий код (строки 1590+) ...
}
```

**Важно:** 
- Информация сохраняется в `this.command.currentCommand._parserInfo`
- Это позволяет получить доступ к parser URL и bet_id в `sendAnswer()` после получения ответа от bcgame.js
- Только для ставок с `betFromParser: true` и нового парсера

---

### 7. Обработка ответа F_BET от bcgame.js (опционально, если нужно сохранить parser info)

**Место:** `mainCycle.proceedAnswer()['F_BET']` - обработчик ответа от bcgame.js (строка 5536)

**Изменения:**
```javascript
// ⭐ МОДИФИЦИРОВАТЬ: Обработчик F_BET для сохранения parser info
'F_BET': (message, bk) => {
    // Сохранить информацию о parser из currentCommand в message (если есть)
    // Это нужно для того, чтобы sendAnswer мог получить доступ к parser URL и bet_id
    if (this.common.command.currentCommand._parserInfo && Object.keys(this.common.command.currentCommand._parserInfo).length > 0) {
        // Получить первую доступную информацию о parser
        const firstParserKey = Object.keys(this.common.command.currentCommand._parserInfo)[0];
        const parserInfo = this.common.command.currentCommand._parserInfo[firstParserKey];
        
        // Добавить информацию о parser в message для последующего использования в sendAnswer
        if (!message._parserInfo) {
            message._parserInfo = parserInfo;
        }
    }
    
    // Вызвать существующий sendAnswer (там будет проверка на parser и отправка отчета)
    this.common.sendAnswer(bk, {
        action: 'F_BET',
        data: message.data,
        answer: message.answer,
        balance: message?.data?.balance,
        doNotSend: !!message.doNotSend,
        _parserInfo: message._parserInfo  // ⭐ Передать информацию о parser
    });
},
```

**Важно:** 
- Это опционально, если информация о parser не сохраняется автоматически
- Если информация уже есть в `currentCommand._parserInfo`, то она будет доступна в `sendAnswer()`
- Для полной гарантии можно добавить передачу `_parserInfo` в message

---

### 8. Отправка отчета на сервер при постановке/непостановке ставки

**Место:** `sendAnswer()` - после обработки ответа (после строки 3715, перед строкой 3716 `_finalSend`)

**Изменения:**
```javascript
sendAnswer(bk, answer, releaseCommand, readyAnswer) {
    // ... существующий код до строки 3715 ...
    
    // ⭐ ДОБАВИТЬ: Отправка отчета на сервер для нового парсера
    // Это выполняется ПЕРЕД отправкой ответа на WebSocket
    if (answer.action === 'BET_RESULT' || answer.action === 'F_BET') {
        if (answer.data && answer.data.status) {
            // Проверить, есть ли сохраненная информация о parser в currentCommand
            const ccBackup = JSON.parse(JSON.stringify(this.command.currentCommand));
            
            // Получить информацию о ставке из текущей команды
            const betData = ccBackup.data && ccBackup.data[0] ? ccBackup.data[0] : null;
            
            if (betData && betData.betFromParser) {
                // Проверить, есть ли сохраненная информация о parser
                let parserInfo = null;
                if (ccBackup._parserInfo && Object.keys(ccBackup._parserInfo).length > 0) {
                    // Получить первую доступную информацию о parser (для первой ставки)
                    const firstParserKey = Object.keys(ccBackup._parserInfo)[0];
                    parserInfo = ccBackup._parserInfo[firstParserKey];
                } else if (betData._parserBetId && betData._parserUrl) {
                    // Если информация есть в данных ставки напрямую
                    parserInfo = {
                        parserUrl: betData._parserUrl,
                        parserBetId: betData._parserBetId
                    };
                }
                
                // Проверить, является ли URL новым парсером
                if (parserInfo && parserInfo.parserUrl && this._isNewParserUrl(parserInfo.parserUrl)) {
                    // ⭐ ОТПРАВИТЬ ОТЧЕТ на сервер
                    this._sendParserBetReport({
                        bet_id: parserInfo.parserBetId,
                        client_id: this.s.websocket_uid,
                        parser_url: parserInfo.parserUrl,
                        bet_status: answer.data.status, // ACCEPTED, NOT_PLACED, FAILED, etc.
                        bet_data: answer.data,
                        original_command: ccBackup.action || 'BET',
                        timestamp: Date.now()
                    }).catch(e => {
                        dLog('red', 'Common', `Failed to send parser bet report: ${e}`);
                    });
                    
                    // Очистить сохраненную информацию после отправки отчета
                    if (this.command.currentCommand._parserInfo) {
                        delete this.command.currentCommand._parserInfo[parserInfo.parserBetId];
                    }
                }
            }
        }
    }
    
    // ... существующий код (строка 3716) ...
    this._finalSend(JSON.parse(JSON.stringify(answer)));
    
    // ... остальной код ...
}
```

**Важно:** 
- Отправка отчета выполняется ПЕРЕД `_finalSend()`
- Проверяется как `BET_RESULT`, так и `F_BET` (ответ от bcgame.js для ставок с парсера)
- Информация о parser берется из `currentCommand._parserInfo` или из данных ставки
- Отчет отправляется только для нового парсера

---

### 9. Новая функция: Отправка отчета на сервер

**Место:** `background.js` - добавить новый метод

**Код:**
```javascript
    // ⭐ НОВАЯ ФУНКЦИЯ: Отправка отчета о ставке из парсера на сервер
    _sendParserBetReport(reportData) {
        const self = this;
        
        // Определить URL сервера для отправки отчета
        // Можно использовать test_url из настроек или определить по websocket_url
        let reportUrl = '';
        
        // ⭐ ВАЖНО: URL сервера определяется из настроек
        // Если есть test_url - использовать его, иначе определить из websocket_url
        if (this._settings.test_url && this._settings.test_url.length > 10) {
            // Использовать test_url если он есть
            reportUrl = this._settings.test_url.replace(/\/$/, '') + '/api/report';
        } else if (this._settings.websocket_url && this._settings.websocket_url.length > 10) {
            // Определить URL сервера из websocket_url
            // ws://server.com:9293 -> http://server.com/api/report
            // wss://server.com:9293 -> https://server.com/api/report
            const protocol = this._settings.websocket_url.indexOf('wss://') === 0 ? 'https' : 'http';
            const wsUrl = this._settings.websocket_url.replace(/^ws[s]?:\/\//, '');
            const wsHost = wsUrl.split('/')[0].split(':')[0];
            reportUrl = `${protocol}://${wsHost}/api/report`;
        } else {
            // Fallback - использовать стандартный URL
            // ⚠️ Это должно быть настроено в settings
            reportUrl = 'http://bcpbet.com/api/report';
        }
    
    // Формировать payload для отчета
    const payload = JSON.stringify({
        action: 'BET_RESULT',
        result: reportData.bet_status === 'ACCEPTED' ? 'SUCCESS' : 'FAILED',
        message: reportData.bet_status === 'ACCEPTED' ? 'Bet placed successfully' : `Bet not placed: ${reportData.bet_status}`,
        room: {
            bk: this.intBkToExternal(this.s.active_bks[0] || ''),
            uid: this.s.websocket_uid,
            state: reportData.bet_status === 'ACCEPTED' ? 'ACCEPTED' : 'FAILED',
            balance: this.bkBalances[this.extBkToInternal(this.s.active_bks[0] || '')] || '0'
        },
        data: {
            status: reportData.bet_status,
            bet_id: reportData.bet_id,
            parser_url: reportData.parser_url,
            external_id: reportData.bet_data.external_id || '',
            market: reportData.bet_data.market || '',
            target: reportData.bet_data.target || '',
            pivot: reportData.bet_data.pivot || '',
            coef: reportData.bet_data.coef || '',
            stake: reportData.bet_data.stake || '',
            maximum: reportData.bet_data.maximum || '0'
        },
        original_command: reportData.original_command || 'BET',
        betFromParser: true,
        parser_bet_id: reportData.bet_id,
        parser_url: reportData.parser_url,
        client_id: reportData.client_id,
        timestamp: reportData.timestamp
    });
    
    // Отправить отчет на сервер
    return fetch(reportUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body: `payload=${encodeURIComponent(payload)}`
    })
    .then(response => response.json())
    .then(data => {
        if (enableFullLogs) {
            dLog('green', 'Common', `Parser bet report sent: ${data.success ? 'success' : 'failed'}`);
        }
        return data;
    })
    .catch(error => {
        dLog('red', 'Common', `Error sending parser bet report: ${error}`);
        throw error;
    });
}
```

**Где добавить:** После метода `_transformFork()` (после строки 4395)

---

### 10. Инициализация переменных для нового парсера

**Место:** В конструкторе класса или в методе `_initSettings()`

**Изменения:**
```javascript
// ⭐ ДОБАВИТЬ: Инициализация переменных для нового парсера
this._currentParserBetId = null;
this._currentParserBetData = null;
this._currentParserUrl = null;
```

**Где добавить:** В конструкторе или в методе инициализации (можно в `_getForkForStakeInit()` в начале)

---

## Структура отчета, который будет отправляться на сервер

```json
{
    "action": "BET_RESULT",
    "result": "SUCCESS" | "FAILED",
    "message": "Bet placed successfully" | "Bet not placed: NOT_PLACED",
    "room": {
        "bk": "BCGAME",
        "uid": "6e74de85-ff2a-4a9e-8689-7d7411e6eac6",
        "state": "ACCEPTED" | "FAILED",
        "balance": "17.33"
    },
    "data": {
        "status": "ACCEPTED" | "NOT_PLACED" | "FAILED",
        "bet_id": "a1b2c3d4e5f6...",
        "parser_url": "http://bcp.bet/new/abb_pairs_pre_fortune/",
        "external_id": "",
        "market": "ONE_TWO",
        "target": "ONE",
        "pivot": "",
        "coef": "2.22",
        "stake": "1",
        "maximum": "0"
    },
    "original_command": "BET",
    "betFromParser": true,
    "parser_bet_id": "a1b2c3d4e5f6...",
    "parser_url": "http://bcp.bet/new/abb_pairs_pre_fortune/",
    "client_id": "6e74de85-ff2a-4a9e-8689-7d7411e6eac6",
    "timestamp": 1738900000000
}
```

---

## Проверка обратной совместимости

### ✅ Старый парсер (URL: `http://bcp.bet/abb_pairs_pre_fortune/`)
- ✅ Не содержит `/new/` - проверка `_isNewParserUrl()` вернет `false`
- ✅ Все новые блоки кода не выполнятся
- ✅ Fetch запрос работает как раньше (без заголовка `X-Client-Id`)
- ✅ Обработка JSON работает как раньше (массив напрямую)
- ✅ Отчет НЕ отправляется на сервер
- ✅ Весь существующий функционал работает без изменений

### ✅ Новый парсер (URL: `http://bcp.bet/new/abb_pairs_pre_fortune/`)
- ✅ Содержит `/new/` - проверка `_isNewParserUrl()` вернет `true`
- ✅ Fetch запрос включает заголовок `X-Client-Id` с `websocket_uid`
- ✅ Обработка нового формата JSON (объект с `status`, `data`, `bet_id`)
- ✅ Сохранение `bet_id` при получении ставки
- ✅ Отправка отчета на сервер при постановке/непостановке ставки
- ✅ Все функции для очереди работают

---

## Порядок внедрения изменений (ТОЛЬКО в background.js)

1. **Шаг 1:** Добавить функцию `_isNewParserUrl()` (проверка URL) - строка ~4396
2. **Шаг 2:** Добавить функцию `_generateBetIdForParser()` (генерация bet_id с учетом URL) - строка ~4397
3. **Шаг 3:** Добавить инициализацию переменных для нового парсера - в `_getForkForStakeInit()` (начало)
4. **Шаг 4:** Модифицировать fetch запрос (добавить заголовок X-Client-Id для нового парсера) - строка 4453
5. **Шаг 5:** Обработать новый формат JSON ответа (объект с status/data/bet_id) - строка 4476
6. **Шаг 6:** Сохранить bet_id при получении ставки (для каждого URL отдельно) - строка 4501
7. **Шаг 7:** Сохранить информацию о parser в `proceedCommand()` - строка 1589
8. **Шаг 8:** (Опционально) Модифицировать обработчик `F_BET` для передачи parser info - строка 5536
9. **Шаг 9:** Добавить функцию `_sendParserBetReport()` (отправка отчета на сервер) - строка ~4400
10. **Шаг 10:** Добавить отправку отчета в `sendAnswer()` (проверка и отправка) - строка 3715

---

## Тестирование

### Тест 1: Старый парсер (обратная совместимость)
- Использовать URL: `http://bcp.bet/abb_pairs_pre_fortune/`
- Убедиться, что все работает как раньше
- Проверить, что отчеты НЕ отправляются

### Тест 2: Новый парсер (новая функциональность)
- Использовать URL: `http://bcp.bet/new/abb_pairs_pre_fortune/`
- Убедиться, что запросы включают `X-Client-Id`
- Проверить обработку нового формата JSON
- Проверить сохранение `bet_id`
- Проверить отправку отчетов на сервер

### Тест 3: Смешанный режим
- Если есть несколько `stakeForks` - один старый, один новый
- Убедиться, что каждый работает по своей логике

---

## Важные замечания

1. **Изменения ТОЛЬКО в background.js** - не трогать bcgame.js и другие файлы
2. **URL парсера вставляется вручную** - пользователь сам добавляет URL в настройки `linkToParser`
3. **Каждая очередь отдельная** - `http://bcp.bet/new/abb_pairs_pre_fortune/` и `http://bcp.bet/new/abb_pairs_pre_fonbet/` имеют разные очереди с разными bet_id
4. **Все изменения условные** - проверка `_isNewParserUrl()` перед каждым новым блоком кода
5. **Отчеты только для нового парсера** - для старого парсера отчеты не отправляются
6. **Не трогаем существующий код** - все новые функции добавляются, а не изменяют существующие
7. **Ошибки не должны ломать работу** - все новые блоки в `try-catch` или с проверками
8. **bet_id уникален для каждого URL** - генерация bet_id включает URL парсера для уникальности
9. **Информация сохраняется в currentCommand** - для доступа при получении ответа от bcgame.js
10. **Обратная совместимость** - старые URL работают как раньше, без изменений

---

## Дополнительные улучшения (опционально)

1. **Разблокировка ставки при NOT_PLACED** - если ставка не поставлена, разблокировать ее в Redis
2. **Rate limiting** - добавить локальный rate limiting для нового парсера
3. **Логирование** - добавить детальное логирование для отладки нового функционала

---

## Особенности реализации для отдельных очередей

### Каждая очередь отдельная для каждого URL

**Важно:** `http://bcp.bet/new/abb_pairs_pre_fortune/` и `http://bcp.bet/new/abb_pairs_pre_fonbet/` это **разные очереди** с **разными bet_id**.

#### Как это обеспечивается:

1. **bet_id включает URL парсера** - функция `_generateBetIdForParser()` создает уникальный bet_id на основе:
   - URL парсера (включается в хеш)
   - Данных ставки (sport, league, teams, market, target, coef)

2. **Сохранение информации по URL** - информация о parser сохраняется отдельно для каждого URL:
   ```javascript
   // В _getForkForStakeInit() для каждого stakeFork.link:
   if (self._isNewParserUrl(stakeFork.link)) {
       // bet_id уникален для каждого URL
       const betHash = self._generateBetIdForParser(stakeFork.link, current);
       // Сохранить с привязкой к URL
       result.data[0]._parserBetId = betHash;
       result.data[0]._parserUrl = stakeFork.link;  // ⭐ URL сохраняется
   }
   ```

3. **Отчеты содержат URL парсера** - в отчете на сервер передается `parser_url`, что позволяет:
   - Идентифицировать, из какой очереди была ставка
   - На сервере разблокировать ставку в правильной очереди
   - Отслеживать статистику по каждому URL отдельно

4. **Множественные stakeForks** - если в настройках несколько `stakeForks` с разными URL:
   - Каждый работает независимо
   - Каждый имеет свою очередь в Redis
   - Каждый отправляет отчеты со своим `parser_url`

#### Пример работы с двумя URL:

```javascript
// Настройки в background.js:
bcgame_stakeForks : [
    {
        linkToParser: 'http://bcp.bet/new/abb_pairs_pre_fortune/',
        // ... другие настройки
    },
    {
        linkToParser: 'http://bcp.bet/new/abb_pairs_pre_fonbet/',
        // ... другие настройки
    }
]

// В _getForkForStakeInit() для каждого stakeFork:
for (const stakeFork of self.stakeForks) {
    // Запрос к парсеру для stakeFork.link
    // Если stakeFork.link === 'http://bcp.bet/new/abb_pairs_pre_fortune/'
    //   -> bet_id будет: bet_abb_pairs_pre_fortune_abc123
    // Если stakeFork.link === 'http://bcp.bet/new/abb_pairs_pre_fonbet/'
    //   -> bet_id будет: bet_abb_pairs_pre_fonbet_xyz789
    
    // Каждый bet_id уникален для своего URL
    // Каждая очередь в Redis отдельная: queue:bets:abb_pairs_pre_fortune и queue:bets:abb_pairs_pre_fonbet
}
```

---

## Финальные замечания

### Гарантии

1. ✅ **Все изменения ТОЛЬКО в background.js** - bcgame.js и другие файлы не трогаются
2. ✅ **Обратная совместимость** - старые URL работают как раньше
3. ✅ **Отдельные очереди** - каждый URL имеет свою очередь с уникальными bet_id
4. ✅ **Условная логика** - все новые блоки проверяют `_isNewParserUrl()`
5. ✅ **Изоляция ошибок** - новые блоки не ломают существующий функционал
6. ✅ **Информация сохраняется** - parser URL и bet_id доступны при отправке отчета

### Точки внедрения (все в background.js)

1. **Строка ~4396:** Функция `_isNewParserUrl()` - проверка URL
2. **Строка ~4397:** Функция `_generateBetIdForParser()` - генерация bet_id
3. **Строка ~4400:** Функция `_sendParserBetReport()` - отправка отчета
4. **Строка 4440:** Инициализация переменных в `_getForkForStakeInit()`
5. **Строка 4453:** Модификация fetch запроса
6. **Строка 4476:** Обработка нового формата JSON
7. **Строка 4501:** Сохранение bet_id при получении ставки
8. **Строка 1589:** Сохранение parser info в `proceedCommand()`
9. **Строка 3715:** Отправка отчета в `sendAnswer()`
10. **Строка 5536:** (Опционально) Обработчик `F_BET` для передачи parser info
