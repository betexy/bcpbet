<?php
/**
 * New Parser API with Redis Locks
 * Handles distributed locking and bet queue management
 */

// Suppress warnings for hex2bin() calls
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start output buffering to catch any warnings
ob_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, X-Client-Id, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Redis connection
function getRedis() {
    static $redis = null;
    if ($redis === null) {
        $redis = new Redis();
        try {
            $redis->connect('redis', 6379, 2.0);
            // Note: We don't use Redis serializer, we handle JSON encoding/decoding manually
            // Redis::SERIALIZER_JSON is not available in Redis 4.3.0 for PHP 7.3
        } catch (Exception $e) {
            error_log("Redis connection error: " . $e->getMessage());
            return null;
        }
    }
    return $redis;
}

// Encryption/Decryption functions (same as parserProxy.php)
function decrypt($data)
{
    try {
        if (strlen($data) < 64) {
            return '';
        }
        
        // First part: base64-encoded hex of ciphertext (everything except last 64 chars)
        $b64CipherHex = substr($data, 0, -64);
        // Last part: base64-encoded hex of nonce (last 64 chars)
        $b64NonceHex = substr($data, -64);
        
        // Decode base64 to get hex strings
        $cipherHex = base64_decode($b64CipherHex, true); // strict mode
        $nonceHex = base64_decode($b64NonceHex, true); // strict mode
        
        if ($cipherHex === false || $nonceHex === false) {
            return '';
        }
        
        // Validate hex strings before converting
        if (!ctype_xdigit($cipherHex) || !ctype_xdigit($nonceHex)) {
            return '';
        }
        
        // Check if hex strings have even length
        if (strlen($cipherHex) % 2 !== 0 || strlen($nonceHex) % 2 !== 0) {
            return '';
        }
        
        // Convert hex to binary (suppress warnings with @ and validate first)
        $ciphertext = false;
        $nonce = false;
        if (ctype_xdigit($cipherHex) && strlen($cipherHex) % 2 === 0) {
            $ciphertext = @hex2bin($cipherHex);
        }
        if (ctype_xdigit($nonceHex) && strlen($nonceHex) % 2 === 0) {
            $nonce = @hex2bin($nonceHex);
        }
        
        if ($ciphertext === false || $nonce === false) {
            return '';
        }
        
        // Get key
        $keyHex = base64_decode('N2ZiMzE2OTk2MWVkZTJhYzU2MWUwMzNkZmNiNWYxZTBkMTgxMmI4ZTI5NGFlN2Q1NzEyMDg5ZWVjODM1YzlmZQ==', true);
        if ($keyHex === false) {
            return '';
        }
        
        // Validate key hex
        if (!ctype_xdigit($keyHex) || strlen($keyHex) % 2 !== 0) {
            return '';
        }
        
        $key = @hex2bin($keyHex);
        if ($key === false) {
            return '';
        }
        
        // Decrypt
        $decrypted = @sodium_crypto_secretbox_open($ciphertext, $nonce, $key);
        return $decrypted !== false ? $decrypted : '';
    } catch (Exception $e) {
        error_log("Decryption error: " . $e->getMessage());
        return '';
    } catch (Error $e) {
        error_log("Decryption error: " . $e->getMessage());
        return '';
    }
}

function encrypt($data)
{
    $key = hex2bin(base64_decode('N2ZiMzE2OTk2MWVkZTJhYzU2MWUwMzNkZmNiNWYxZTBkMTgxMmI4ZTI5NGFlN2Q1NzEyMDg5ZWVjODM1YzlmZQ=='));
    $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $encrypted = sodium_crypto_secretbox($data, $nonce, $key);
    return base64_encode(bin2hex($encrypted)) . base64_encode(bin2hex($nonce));
}

// Get client ID from header
// CRITICAL: If no clientId provided, generate one from IP+User-Agent to prevent lock bypass
$clientId = $_SERVER['HTTP_X_CLIENT_ID'] ?? '';
if (empty($clientId)) {
    // Fallback: generate unique ID from IP and User-Agent
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    $clientId = 'auto_' . md5($ip . $ua);
    error_log("WARNING: No X-Client-Id header provided, generated fallback: {$clientId}");
}

// Normalize parser URL so /new/abb_pairs_pre_stake and /new/abb_pairs_pre_stake/ yield same lock
$requestUriRaw = $_SERVER['REQUEST_URI'] ?? '';
$requestUri = '/' . trim(parse_url($requestUriRaw, PHP_URL_PATH) ?: $requestUriRaw, '/');
$queueKey = 'parser_queue:' . md5($requestUri);

// Log request URI for debugging (can be removed after verification)
error_log("API Request URI: {$requestUri}, Client ID: {$clientId}");

$redis = getRedis();
if (!$redis) {
    http_response_code(503);
    echo json_encode(['error' => 'Redis unavailable']);
    exit;
}

// Parse URI to determine which JSON file to serve
// Example: /new/abb_pairs_pre_fortune/ -> current_abb_pairs_pre_fortune.json
$requestPath = parse_url($requestUri, PHP_URL_PATH);
$uriParts = array_filter(explode('/', trim($requestPath, '/')), function($part) {
    return !empty($part) && $part !== 'api.php';
});

// Get the last non-empty part as bookie key
$uriPartsArray = array_values($uriParts);
$bookieKey = !empty($uriPartsArray) ? end($uriPartsArray) : '';

// If bookieKey is 'new', try to get from previous part
if ($bookieKey === 'new' && count($uriPartsArray) >= 2) {
    $bookieKey = $uriPartsArray[count($uriPartsArray) - 2];
}

if (empty($bookieKey)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid parser URL']);
    exit;
}

// Load parser configuration
$parserConfig = include(__DIR__ . '/parser_config.php');
$defaultConfig = $parserConfig['default'] ?? [
    'maxBotsPerBet' => 2,
    'lockTimeout' => 60,
    'rateLimitWindow' => 10,
];

// Get config for this specific parser, or use default
$currentParserConfig = $parserConfig['parsers'][$bookieKey] ?? $defaultConfig;

// Merge with defaults for any missing keys
$maxBotsPerBet = $currentParserConfig['maxBotsPerBet'] ?? $defaultConfig['maxBotsPerBet'];
$lockTimeout = $currentParserConfig['lockTimeout'] ?? $defaultConfig['lockTimeout'];
$rateLimitWindow = $currentParserConfig['rateLimitWindow'] ?? $defaultConfig['rateLimitWindow'];
$successLockTimeout = $currentParserConfig['successLockTimeout'] ?? $defaultConfig['successLockTimeout'] ?? 600;

// Log config for debugging
error_log("Parser config for '{$bookieKey}': maxBotsPerBet={$maxBotsPerBet}, lockTimeout={$lockTimeout}, rateLimitWindow={$rateLimitWindow}");

$jsonFile = __DIR__ . "/current_{$bookieKey}.json";
if (!file_exists($jsonFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'Parser file not found', 'file' => $jsonFile]);
    exit;
}

// Read and decrypt the JSON file
$encryptedContent = file_get_contents($jsonFile);
if (empty($encryptedContent)) {
    http_response_code(204); // No Content
    echo json_encode([]);
    exit;
}

// Check if file should be encrypted (not in doNotEncrypt list)
// This list must match the one in parserProxy.php
$doNotEncrypt = [
    '123456789', 'abb_pairs_pre_1x', 'abb_pairs_pre_poly', 'abb_pairs_pre_csgo',
    'abb_pairs_pre_bcgame', 'abb_pairs_pre_duel', 'abb_pairs_pre_duel1',
    'abb_pairs_pre_betplay', 'abb_pairs_pre_rainbet', 'abb_pairs_pre_jb', 'abb_pairs_pre_roobet',
    'premalp1', 'alp1', 'alpin1',
];
$shouldDecrypt = !in_array($bookieKey, $doNotEncrypt);

if ($shouldDecrypt) {
    $content = decrypt($encryptedContent);
    // If decryption failed (empty result), try to use content as-is (maybe it's not encrypted)
    if (empty($content)) {
        $content = $encryptedContent;
    }
} else {
    $content = $encryptedContent;
}

if (empty($content)) {
    http_response_code(204);
    echo json_encode([]);
    exit;
}

$bets = json_decode($content, true);
if (!is_array($bets) || empty($bets)) {
    http_response_code(204);
    echo json_encode([]);
    exit;
}

// Rate limiting: Check if client can get a bet
$rateLimitKey = "parser_rate_limit:{$queueKey}:{$clientId}";
$lastBetTime = $redis->get($rateLimitKey);
$currentTime = time();
// $rateLimitWindow is set from config above

if ($lastBetTime && ($currentTime - $lastBetTime) < $rateLimitWindow) {
    $waitTime = $rateLimitWindow - ($currentTime - $lastBetTime);
    http_response_code(429); // Too Many Requests
    echo json_encode([
        'error' => 'Rate limit exceeded',
        'retry_after' => $waitTime,
        'message' => "You can get next bet in {$waitTime} seconds"
    ]);
    exit;
}

// Find available bet (not locked by max number of clients)
// We iterate through bets and try to acquire a lock using Redis SET (allows multiple clients)
// maxBotsPerBet and lockTimeout are set from parser_config.php
$availableBet = null;
$betIndex = null;
$betLockKey = null;
$betId = null;

foreach ($bets as $index => $bet) {
    // Generate unique bet ID based on ONLY match-identifying fields
    // This ensures ONE betId per match, regardless of market/target/pivot
    // Fields used: homeTeam, awayTeam, league
    $betForId = [
        'homeTeam' => $bet['homeTeam'] ?? '',
        'awayTeam' => $bet['awayTeam'] ?? '',
        'league' => $bet['league'] ?? '',
    ];
    
    // Generate betId based only on core identifying fields
    $betData = json_encode($betForId, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $betId = 'bet:' . md5($queueKey . $betData);
    $betLockKey = "parser_lock:{$queueKey}:{$betId}";
    
    // Use Redis SET to allow multiple clients (up to $maxBotsPerBet) to lock the same bet
    // SADD adds member to set, returns 1 if added, 0 if already exists
    // SCARD returns the number of members in the set
    
    // Atomic lock acquisition using Lua script to prevent race conditions
    // The script checks count, adds if room, and returns whether lock was acquired
    $luaScript = <<<'LUA'
local key = KEYS[1]
local clientId = ARGV[1]
local maxBots = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

-- Check if client already has lock
if redis.call('SISMEMBER', key, clientId) == 1 then
    redis.call('EXPIRE', key, ttl)
    return 1  -- Already has lock, refreshed TTL
end

-- Check current count
local count = redis.call('SCARD', key)
if count >= maxBots then
    return 0  -- Max reached, no lock
end

-- Try to add (atomic with the check above in Lua)
redis.call('SADD', key, clientId)

-- Verify count after add (double-check for safety)
local newCount = redis.call('SCARD', key)
if newCount > maxBots then
    -- Too many - we lost the race, remove ourselves
    redis.call('SREM', key, clientId)
    return 0
end

-- Set TTL and return success
redis.call('EXPIRE', key, ttl)
return 1
LUA;

    try {
        $lockAcquired = $redis->eval($luaScript, [$betLockKey, $clientId, $maxBotsPerBet, $lockTimeout], 1);
    } catch (\Throwable $e) {
        $lockAcquired = false;
        error_log("PARSER_LOCK: Redis eval failed: " . $e->getMessage());
    }
    $lockAcquired = (bool) $lockAcquired;

    // Log lock attempt result with full details (write to file)
    $currentCount = $redis->sCard($betLockKey);
    $members = $redis->sMembers($betLockKey);
    $membersStr = implode(',', $members ?: []);
    $logLine = '[' . gmdate('Y-m-d H:i:s') . ' UTC] LOCK_DEBUG: key=' . $betLockKey
        . ', betId=' . $betId
        . ', clientId=' . $clientId
        . ', parserUrl=' . $requestUri
        . ', maxBots=' . $maxBotsPerBet
        . ', lockTimeout=' . $lockTimeout
        . ', evalResult=' . var_export($lockAcquired, true)
        . ', currentCount=' . $currentCount
        . ', members=[' . $membersStr . ']';
    error_log($logLine . PHP_EOL, 3, '/tmp/parser_lock.log');
    
    if ($lockAcquired) {
        $availableBet = $bet;
        $betIndex = $index;
        break;
    }
    // Lock not acquired, continue to next bet
}

if ($availableBet === null) {
    // No available bets
    http_response_code(204); // No Content
    echo json_encode([]);
    exit;
}

// Update rate limit
$redis->setex($rateLimitKey, $rateLimitWindow, $currentTime);

// Log betId generation for verification (can be removed after testing)
$betInfoForLog = [
    'betId' => $betId,
    'homeTeam' => $availableBet['homeTeam'] ?? 'N/A',
    'awayTeam' => $availableBet['awayTeam'] ?? 'N/A',
    'market' => $availableBet['market'] ?? 'N/A',
    'target' => $availableBet['target'] ?? 'N/A',
    'league' => $availableBet['league'] ?? 'N/A',
    'clientId' => $clientId
];
error_log("BET_ID_GENERATED: " . json_encode($betInfoForLog, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

// Store bet info for reporting (to track if bet was placed)
$betInfoKey = "parser_bet_info:{$queueKey}:{$betId}";
$redis->setex($betInfoKey, 3600, json_encode([
    'client_id' => $clientId,
    'bet_id' => $betId,
    'parser_url' => $requestUri,
    'bet_data' => $availableBet,
    'timestamp' => $currentTime
]));

// Check for Pinnacle/Betfair fork overlap on same match+market
$sharpHome = mb_strtolower(trim($availableBet['homeTeam'] ?? ''));
$sharpAway = mb_strtolower(trim($availableBet['awayTeam'] ?? ''));
$sharpMarket = mb_strtolower(trim($availableBet['market'] ?? ''));
if ($sharpHome !== '' && $sharpAway !== '') {
    $sharpKey = 'sharp_fork:' . md5($sharpHome . ':' . $sharpAway . ':' . $sharpMarket);
    if ($redis->exists($sharpKey)) {
        $availableBet['_pinnacle_betfair_overlap'] = true;
    }
}

// Return the bet (encrypted if needed)
// Add bet_id and parser_url to bet data for tracking
$availableBet['_parser_bet_id'] = $betId;
$availableBet['_parser_url'] = $requestUri;
$availableBet['_parser_client_id'] = $clientId;
$availableBet['_parser_success_lock_timeout'] = $successLockTimeout;

$responseData = [$availableBet];
$responseJson = json_encode($responseData);

// Clear any warnings from output buffer
ob_clean();

if ($shouldDecrypt) {
    echo encrypt($responseJson);
} else {
    echo $responseJson;
}

// End output buffering
ob_end_flush();
