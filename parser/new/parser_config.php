<?php
/**
 * Parser Lock Configuration
 * 
 * Настройки блокировок для разных парсеров.
 * 
 * maxBotsPerBet - сколько ботов могут одновременно получить одну ставку
 * lockTimeout - через сколько секунд lock истекает автоматически
 * rateLimitWindow - минимальный интервал между запросами от одного бота (секунды)
 */

return [
    // Настройки по умолчанию для всех парсеров
    'default' => [
        'maxBotsPerBet' => 2,         // По умолчанию 2 бота на ставку
        'lockTimeout' => 60,          // 60 секунд до истечения lock
        'rateLimitWindow' => 10,      // 10 секунд между запросами
        'successLockTimeout' => 7200,  // 20 минут блокировки после успешной ставки
    ],
    
    // Настройки для конкретных парсеров (по bookieKey из URL)
    // Пример: /new/abb_pairs_pre_fortune/ -> bookieKey = "abb_pairs_pre_fortune"
    'parsers' => [
        // 1x - только 1 бот на ставку
        // lockTimeout большой потому что farm боты не присылают отчёты с parser_bet_id
        'abb_pairs_pre_1x' => [
            'maxBotsPerBet' => 2,
            'lockTimeout' => 60,        // 20 минут начальный lock (т.к. боты не шлют отчёты)
            'successLockTimeout' => 2200, // 20 минут после успешной ставки (если бот пошлёт отчёт)
        ],
        
        // Пример: для fortune разрешить 2 бота на ставку
        // 'abb_pairs_pre_fortune' => [
        //     'maxBotsPerBet' => 2,
        //     'lockTimeout' => 60,
        //     'rateLimitWindow' => 10,
        //     'successLockTimeout' => 600, // 10 минут после успешной ставки
        // ],
        
        // Пример: для csgo более агрессивные настройки
        // 'abb_pairs_pre_csgo' => [
        //     'maxBotsPerBet' => 2,
        //     'lockTimeout' => 30,
        //     'rateLimitWindow' => 5,
        //     'successLockTimeout' => 300, // 5 минут после успешной ставки
        // ],
        
        // Добавляйте свои настройки здесь:
        
    ],
];
