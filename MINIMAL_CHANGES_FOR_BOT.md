# Минимальные изменения для перехода на новый парсер с lock

## Что нужно изменить в существующем боте

### 1. Изменить URL запроса

**Было:**
```python
parser_url = "http://bcp.bet/abb_pairs_pre_1x/"
```

**Стало:**
```python
parser_url = "http://bcp.bet/new/abb_pairs_pre_1x/"
```

### 2. Добавить заголовок `X-Client-Id` в запрос

**Было:**
```python
response = requests.get(parser_url)
```

**Стало:**
```python
import uuid

# Генерируем или используем постоянный client_id для этого бота
client_id = "your-bot-id"  # или str(uuid.uuid4())

headers = {
    'X-Client-Id': client_id,
    'Accept': 'application/json'
}

response = requests.get(parser_url, headers=headers)
```

### 3. Обработать rate limit (опционально, но рекомендуется)

Новый API возвращает `429 Too Many Requests`, если запросы слишком частые (лимит: 1 запрос в 10 секунд на один `client_id`).

**Добавить обработку:**
```python
if response.status_code == 429:
    error_data = response.json()
    wait_time = error_data.get('retry_after', 20)
    print(f"Rate limit: подождать {wait_time} секунд")
    time.sleep(wait_time)
    # Повторить запрос
```

## Полный пример изменения

### До (старый парсер):
```python
import requests

parser_url = "http://bcp.bet/abb_pairs_pre_1x/"

def get_bet():
    response = requests.get(parser_url)
    if response.status_code == 200:
        bets = response.json()
        if bets:
            return bets[0]
    return None
```

### После (новый парсер с lock):
```python
import requests
import uuid
import time

parser_url = "http://bcp.bet/new/abb_pairs_pre_1x/"
client_id = str(uuid.uuid4())  # или постоянный ID для бота

def get_bet():
    headers = {
        'X-Client-Id': client_id,
        'Accept': 'application/json'
    }
    
    response = requests.get(parser_url, headers=headers, timeout=10)
    
    if response.status_code == 429:
        # Rate limit - обработать или просто вернуть None
        error_data = response.json()
        wait_time = error_data.get('retry_after', 20)
        print(f"Rate limit: подождать {wait_time} секунд")
        return None
    
    if response.status_code == 200:
        bets = response.json()
        if isinstance(bets, list) and len(bets) > 0:
            bet = bets[0]
            # В bet теперь есть поля: _parser_bet_id, _parser_url, _parser_client_id
            return bet
    
    # 204 - нет ставок, или другая ошибка
    return None
```

## Что происходит автоматически на сервере

✅ **Lock ставится автоматически** при выдаче ставки:
- API получает ваш запрос с `X-Client-Id`
- Находит доступную ставку (заблокированную менее чем N ботами, где N настраивается в конфиге)
- Ставит Redis lock на эту ставку для вашего `client_id`
- Возвращает ставку вам

✅ **Lock снимается автоматически** через заданное время, если вы не отправили отчет

## Настройка парсеров

Настройки хранятся в файле `parser/new/parser_config.php`:

```php
return [
    // Настройки по умолчанию для всех парсеров
    'default' => [
        'maxBotsPerBet' => 2,        // Сколько ботов могут получить одну ставку
        'lockTimeout' => 60,         // Через сколько секунд lock истекает
        'rateLimitWindow' => 10,     // Минимальный интервал между запросами (сек)
        'successLockTimeout' => 600, // Блокировка после успешной ставки (сек)
    ],
    
    // Настройки для конкретных парсеров (по ключу из URL)
    'parsers' => [
        // Пример: для 1x только 1 бот
        'abb_pairs_pre_1x' => [
            'maxBotsPerBet' => 1,
        ],
        
        // Пример: для fortune короткая блокировка после ставки
        'abb_pairs_pre_fortune' => [
            'maxBotsPerBet' => 2,
            'successLockTimeout' => 300, // 5 минут
        ],
    ],
];
```

**Ключ парсера** берётся из URL: `/new/abb_pairs_pre_fortune/` → `abb_pairs_pre_fortune`

## Важно

1. **`client_id` должен быть уникальным** для каждого бота. Если у вас несколько ботов:
   - Используйте разные `client_id` для каждого
   - Или используйте один `client_id`, но тогда все боты будут считаться одним клиентом (и rate limit будет общим)

2. **Формат ответа такой же** - массив с одной ставкой `[{...}]`

3. **Lock на стороне сервера** - ваш бот ничего не делает для установки/снятия lock, только отправляет запрос с `X-Client-Id`

## Отправка отчетов (опционально, но рекомендуется)

Если хотите, чтобы lock снимался сразу после размещения ставки (а не через 2 минуты), отправляйте отчет:

### Формат отчета

**URL**: `POST http://bcp.bet/BotManager/api/report`

**Content-Type**: `application/x-www-form-urlencoded`

**Body**: `payload={json_encoded_payload}`

### Структура payload (JSON)

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
    "parser_bet_id": "bet:abc123...",
    "parser_url": "/new/abb_pairs_pre_1x/",
    "client_id": "6e74de85-ff2a-4a9e-8689-7d7411e6eac6",
    "timestamp": 1738900000000
}
```

### Обязательные поля для unlock механизма

Для снятия lock критически важны следующие поля (должны совпадать с данными из полученной ставки):
- `parser_bet_id` - берется из `bet_data["_parser_bet_id"]`
- `parser_url` - берется из `bet_data["_parser_url"]`
- `client_id` - берется из `bet_data["_parser_client_id"]` или ваш `client_id`
- `data.status` - статус ставки: `"ACCEPTED"`, `"NOT_PLACED"`, или `"FAILED"`

### Пример кода отправки отчета

```python
import requests
import json
import time

def send_report(bet_data, status, report_url="http://bcp.bet/BotManager/api/report"):
    """
    Отправить отчет о размещении ставки
    
    Args:
        bet_data: Данные ставки, полученные из get_bet() (содержит _parser_bet_id, _parser_url, _parser_client_id)
        status: Статус ставки - 'ACCEPTED', 'NOT_PLACED', или 'FAILED'
        report_url: URL для отправки отчета (по умолчанию http://bcp.bet/BotManager/api/report)
    
    Returns:
        bool: True если отчет отправлен успешно, False иначе
    """
    
    # Извлекаем необходимые данные из bet_data
    parser_bet_id = bet_data.get("_parser_bet_id")
    parser_url = bet_data.get("_parser_url")
    client_id = bet_data.get("_parser_client_id")
    
    if not parser_bet_id or not parser_url:
        print("Ошибка: отсутствуют обязательные поля _parser_bet_id или _parser_url")
        return False
    
    # Формируем payload
    payload_data = {
        "action": "BET_RESULT",
        "result": "SUCCESS" if status == "ACCEPTED" else "FAILED",
        "message": "Bet placed successfully" if status == "ACCEPTED" else f"Bet not placed: {status}",
        "room": {
            "bk": bet_data.get("bookmaker", "").upper() if bet_data.get("bookmaker") else "",
            "uid": client_id or "",
            "state": status,
            "balance": "0"  # Заполните реальным балансом, если есть
        },
        "data": {
            "status": status,
            "bet_id": bet_data.get("bet_id", ""),
            "external_id": bet_data.get("external_id", ""),
            "market": bet_data.get("market", ""),
            "target": bet_data.get("target", ""),
            "pivot": bet_data.get("pivot", ""),
            "coef": bet_data.get("coef", ""),
            "stake": bet_data.get("stake", ""),
            "maximum": bet_data.get("maximum", "0")
        },
        "original_command": "BET",
        "betFromParser": True,
        "parser_bet_id": parser_bet_id,  # Обязательно для unlock
        "parser_url": parser_url,  # Обязательно для unlock
        "client_id": client_id or "",  # Обязательно для unlock
        "timestamp": int(time.time() * 1000)
    }
    
    # Отправляем POST запрос
    try:
        response = requests.post(
            report_url,
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            data={
                'payload': json.dumps(payload_data, ensure_ascii=False)
            },
            timeout=10
        )
        
        if response.ok:
            result = response.json()
            print(f"Отчет отправлен: {result.get('success', False)}")
            return result.get('success', False)
        else:
            print(f"Ошибка отправки отчета: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"Ошибка отправки отчета: {e}")
        return False
```

### Минимальный пример (только обязательные поля для unlock)

Если вам нужно только снять lock и не важна остальная статистика:

```python
def send_report_minimal(bet_data, status):
    """Минимальный отчет только для снятия lock"""
    report_url = "http://bcp.bet/BotManager/api/report"
    
    payload_data = {
        "action": "BET_RESULT",
        "result": "SUCCESS" if status == "ACCEPTED" else "FAILED",
        "parser_bet_id": bet_data.get("_parser_bet_id"),  # Обязательно
        "parser_url": bet_data.get("_parser_url"),  # Обязательно
        "client_id": bet_data.get("_parser_client_id"),  # Обязательно
        "data": {
            "status": status  # Обязательно: "ACCEPTED" | "NOT_PLACED" | "FAILED"
        },
        "betFromParser": True
    }
    
    response = requests.post(
        report_url,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        data={'payload': json.dumps(payload_data)}
    )
    
    return response.ok
```

### Пример использования

```python
# Получаем ставку
bet = get_bet()
if bet:
    print(f"Получена ставка: {bet.get('homeTeam')} vs {bet.get('awayTeam')}")
    
    # Размещаем ставку на букмекерской конторе
    # ... ваш код размещения ставки ...
    
    # Определяем статус
    if bet_was_placed:
        status = "ACCEPTED"
    else:
        status = "NOT_PLACED"  # или "FAILED"
    
    # Отправляем отчет
    send_report(bet, status)
```

### Важно

- **Без отчета**: Lock автоматически истечет через `lockTimeout` секунд (по умолчанию 60)
- **С отчетом и статусом `ACCEPTED`**: Lock продлевается на 10 минут (ставка размещена успешно)  
- **С отчетом и статусом `NOT_PLACED` или `FAILED`**: Lock снимается сразу (ставка не размещена, ставка снова доступна другим ботам)
- **Количество ботов на ставку** настраивается через `maxBotsPerBet` в `parser_config.php`