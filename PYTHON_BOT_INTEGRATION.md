# Интеграция Python-ботов с новым парсером

## Обзор

Новый парсер использует Redis для блокировки ставок (distributed locking), чтобы предотвратить ситуацию, когда несколько ботов берут одну и ту же ставку одновременно. Lock ставится автоматически на стороне API при получении ставки.

## Основные принципы

1. **Lock механизм**: API автоматически ставит Redis lock при выдаче ставки. Lock держится 2 минуты (120 секунд).
2. **Rate limiting**: Один бот может запросить ставку не чаще, чем раз в 20 секунд.
3. **Client ID**: Каждый бот должен иметь уникальный `client_id` (например, UUID).
4. **Отчеты**: После размещения ставки бот должен отправить отчет, чтобы снять lock (если ставка не размещена).

## 1. Получение ставки из парсера

### URL формат

```
http://bcpbet.com/new/{bookie_key}/
```

Примеры:
- `http://bcpbet.com/new/abb_pairs_pre_fortune/`
- `http://bcpbet.com/new/alp1/`
- `http://bcpbet.com/new/abb_pairs_pre_1x/`

### Запрос

**Метод**: `GET`

**Заголовки**:
```python
headers = {
    'X-Client-Id': 'your-unique-client-id',  # Например, UUID: '6e74de85-ff2a-4a9e-8689-7d7411e6eac6'
    'Accept': 'application/json'
}
```

### Ответ

**Успешный ответ (200)**:
```json
[
    {
        "homeTeam": "Team A",
        "awayTeam": "Team B",
        "market": "ONE_TWO",
        "target": "ONE",
        "coef": "2.22",
        "income": "1.22",
        "btsid": "...",
        "_parser_bet_id": "bet:abc123...",
        "_parser_url": "/new/abb_pairs_pre_fortune/",
        "_parser_client_id": "your-unique-client-id",
        ...
    }
]
```

**Нет ставок (204)**: Пустой массив `[]` или статус 204

**Rate limit превышен (429)**:
```json
{
    "error": "Rate limit exceeded",
    "retry_after": 15,
    "message": "You can get next bet in 15 seconds"
}
```

**Нет доступных ставок (204)**: Все ставки заблокированы другими ботами

### Особенности

1. **Расшифровка данных**: Некоторые очереди парсера зашифрованы. Список незашифрованных очередей:
   - `123456789`
   - `abb_pairs_pre_1x`
   - `abb_pairs_pre_poly`
   - `abb_pairs_pre_csgo`
   - `premalp1`
   - `alp1`
   - `alpin1`

   Все остальные очереди возвращают зашифрованные данные, которые нужно расшифровать на клиенте.

2. **Lock автоматический**: При успешном запросе API автоматически блокирует ставку в Redis на 2 минуты для вашего `client_id`. Другие боты не смогут получить эту же ставку, пока lock активен.

3. **Повторный запрос**: Если вы сделаете повторный запрос с тем же `client_id`, вы получите ту же ставку (если она еще не размещена), и lock будет обновлен до 2 минут.

## 2. Пример кода на Python

```python
import requests
import uuid
import json
import time
from typing import Optional, Dict, Any

class ParserBot:
    def __init__(self, parser_url: str, client_id: Optional[str] = None):
        """
        Инициализация бота для работы с новым парсером
        
        Args:
            parser_url: URL парсера, например 'http://bcpbet.com/new/abb_pairs_pre_fortune/'
            client_id: Уникальный ID клиента. Если не указан, будет сгенерирован UUID
        """
        self.parser_url = parser_url
        self.client_id = client_id or str(uuid.uuid4())
        self.last_request_time = 0
        self.min_request_interval = 20  # секунд
        
    def get_bet(self) -> Optional[Dict[str, Any]]:
        """
        Получить ставку из парсера
        
        Returns:
            Dict с данными ставки или None, если ставок нет
        """
        # Проверка rate limit
        current_time = time.time()
        time_since_last_request = current_time - self.last_request_time
        if time_since_last_request < self.min_request_interval:
            wait_time = self.min_request_interval - time_since_last_request
            print(f"Rate limit: нужно подождать {wait_time:.1f} секунд")
            return None
        
        headers = {
            'X-Client-Id': self.client_id,
            'Accept': 'application/json'
        }
        
        try:
            response = requests.get(self.parser_url, headers=headers, timeout=10)
            self.last_request_time = time.time()
            
            if response.status_code == 204:
                # Нет ставок
                return None
            
            if response.status_code == 429:
                # Rate limit превышен
                error_data = response.json()
                wait_time = error_data.get('retry_after', 20)
                print(f"Rate limit exceeded. Подождите {wait_time} секунд")
                self.last_request_time = time.time() - (self.min_request_interval - wait_time)
                return None
            
            if response.status_code == 200:
                bets = response.json()
                if isinstance(bets, list) and len(bets) > 0:
                    bet = bets[0]
                    print(f"Получена ставка: {bet.get('_parser_bet_id')}")
                    return bet
            
            print(f"Неожиданный ответ: {response.status_code}")
            return None
            
        except requests.exceptions.RequestException as e:
            print(f"Ошибка запроса: {e}")
            return None
    
    def send_report(self, bet_data: Dict[str, Any], status: str, report_url: str = None) -> bool:
        """
        Отправить отчет о размещении ставки
        
        Args:
            bet_data: Данные ставки, полученные из get_bet()
            status: Статус ставки ('ACCEPTED', 'NOT_PLACED', 'FAILED')
            report_url: URL для отправки отчета. Если не указан, используется базовый URL из parser_url
        
        Returns:
            True если отчет отправлен успешно, False иначе
        """
        if not bet_data.get('_parser_bet_id'):
            print("Ошибка: отсутствует _parser_bet_id в данных ставки")
            return False
        
        # Определяем URL для отчета
        if not report_url:
            # Извлекаем базовый URL из parser_url
            # http://bcpbet.com/new/abb_pairs_pre_fortune/ -> http://bcpbet.com
            base_url = self.parser_url.split('/new/')[0]
            report_url = f"{base_url}/BotManager/api/report"
        
        # Формируем payload для отчета
        payload_data = {
            "action": "BET_RESULT",
            "result": "SUCCESS" if status == "ACCEPTED" else "FAILED",
            "message": "Bet placed successfully" if status == "ACCEPTED" else f"Bet not placed: {status}",
            "room": {
                "bk": bet_data.get("bookmaker", "").upper(),
                "uid": self.client_id,
                "state": status,
                "balance": "0"  # Заполните реальным балансом если есть
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
            "parser_bet_id": bet_data["_parser_bet_id"],
            "parser_url": bet_data["_parser_url"],
            "client_id": self.client_id,
            "timestamp": int(time.time() * 1000)
        }
        
        # Отправляем отчет
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


# Пример использования
if __name__ == "__main__":
    # Создаем бота с уникальным client_id
    bot = ParserBot(
        parser_url="http://bcpbet.com/new/abb_pairs_pre_fortune/",
        client_id=str(uuid.uuid4())  # Или используйте постоянный ID
    )
    
    # Получаем ставку
    bet = bot.get_bet()
    
    if bet:
        print(f"Получена ставка: {bet.get('homeTeam')} vs {bet.get('awayTeam')}")
        print(f"Bet ID: {bet.get('_parser_bet_id')}")
        
        # Здесь ваш код для размещения ставки на букмекерской конторе
        # ...
        
        # После размещения отправляем отчет
        bet_status = "ACCEPTED"  # или "NOT_PLACED", "FAILED"
        bot.send_report(bet, bet_status)
    else:
        print("Ставок нет или превышен rate limit")
```

## 3. Важные моменты

### Client ID

`client_id` должен быть уникальным для каждого бота. Если у вас несколько ботов, используйте разные `client_id` для каждого. `client_id` можно:
- Сгенерировать один раз и сохранить в файл/базу данных
- Использовать постоянный ID для конкретного бота (например, имя бота + UUID)

### Rate Limiting

API ограничивает запросы: **1 запрос в 20 секунд** на один `client_id`. Если вы превысите лимит, получите статус 429 с информацией о времени ожидания.

### Lock механизм

Lock ставится автоматически при получении ставки и держится **2 минуты**. Если вы не отправите отчет, lock автоматически истечет через 2 минуты, и ставка снова станет доступной другим ботам.

### Отправка отчетов

**Важно**: После размещения ставки (или если ставка не размещена) отправьте отчет на `/BotManager/api/report`. Это необходимо для:
1. Снятия lock (если ставка не размещена)
2. Статистики и мониторинга
3. Правильной работы системы распределенных блокировок

### Расшифровка данных

Если очередь зашифрована, API вернет зашифрованные данные. Вам нужно будет реализовать функцию расшифровки на Python (аналог функции `decrypt()` из `api.php`). Если расшифровка не критична для вашей задачи, можете работать с незашифрованными очередями:
- `abb_pairs_pre_1x`
- `abb_pairs_pre_poly`
- `abb_pairs_pre_csgo`
- `alp1`
- `alpin1`
- `premalp1`

## 4. Обработка ошибок

- **503 Service Unavailable**: Redis недоступен - повторите запрос позже
- **404 Not Found**: Указан неверный URL парсера или файл не существует
- **400 Bad Request**: Неверный формат URL парсера
- **429 Too Many Requests**: Превышен rate limit - подождите указанное время
- **204 No Content**: Нет доступных ставок

## 5. Тестирование

Для тестирования можно использовать незашифрованные очереди:
- `http://bcpbet.com/new/alp1/`
- `http://bcpbet.com/new/abb_pairs_pre_1x/`

Эти очереди возвращают данные в открытом виде (JSON без шифрования).
