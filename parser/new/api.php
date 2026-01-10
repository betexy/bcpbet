<?php
/**
 * New Parser API with Redis Locks
 * Handles distributed locking and bet queue management
 */

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
            $redis->setOption(Redis::OPT_SERIALIZER, Redis::SERIALIZER_JSON);
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
        $cipherHex = base64_decode($b64CipherHex);
        $nonceHex = base64_decode($b64NonceHex);
        
        if ($cipherHex === false || $nonceHex === false) {
            return '';
        }
        
        // Convert hex to binary
        $ciphertext = hex2bin($cipherHex);
        $nonce = hex2bin($nonceHex);
        
        if ($ciphertext === false || $nonce === false) {
            return '';
        }
        
        // Get key
        $keyHex = base64_decode('N2ZiMzE2OTk2MWVkZTJhYzU2MWUwMzNkZmNiNWYxZTBkMTgxMmI4ZTI5NGFlN2Q1NzEyMDg5ZWVjODM1YzlmZQ==');
        $key = hex2bin($keyHex);
        
        if ($key === false) {
            return '';
        }
        
        // Decrypt
        $decrypted = sodium_crypto_secretbox_open($ciphertext, $nonce, $key);
        return $decrypted !== false ? $decrypted : '';
    } catch (Exception $e) {
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
$clientId = $_SERVER['HTTP_X_CLIENT_ID'] ?? '';

// Get request URI to determine which queue to use
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$queueKey = 'parser_queue:' . md5($requestUri);

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
$doNotEncrypt = ['123456789', 'premalp1', 'alp1', 'alpin1'];
$shouldDecrypt = !in_array($bookieKey, $doNotEncrypt);

$content = $shouldDecrypt ? decrypt($encryptedContent) : $encryptedContent;
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

// Rate limiting: Check if client can get a bet (one per minute per client)
$rateLimitKey = "parser_rate_limit:{$queueKey}:{$clientId}";
$lastBetTime = $redis->get($rateLimitKey);
$currentTime = time();
$rateLimitWindow = 60; // 1 minute in seconds

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

// Find available bet (not locked by another client)
$availableBet = null;
$betIndex = null;
$betLockKey = null;
$betId = null;

foreach ($bets as $index => $bet) {
    // Generate unique bet ID based on bet content and URL
    $betData = json_encode($bet);
    $betId = 'bet:' . md5($queueKey . $betData . $index);
    $betLockKey = "parser_lock:{$queueKey}:{$betId}";
    
    // Try to acquire lock for this bet
    $lockAcquired = $redis->set($betLockKey, $clientId, ['nx', 'ex' => 120]); // Lock for 2 minutes
    
    if ($lockAcquired) {
        $availableBet = $bet;
        $betIndex = $index;
        break;
    }
    
    // Check if this bet is locked by current client (already taken by this client)
    $lockedBy = $redis->get($betLockKey);
    if ($lockedBy === $clientId) {
        // Client already has this bet, return it again and refresh lock
        // This allows client to retrieve the bet again if needed (e.g., after page reload)
        $availableBet = $bet;
        $betIndex = $index;
        // Refresh lock
        $redis->expire($betLockKey, 120);
        break;
    }
    // If locked by another client, continue to next bet
}

if ($availableBet === null) {
    // No available bets
    http_response_code(204); // No Content
    echo json_encode([]);
    exit;
}

// Update rate limit
$redis->setex($rateLimitKey, $rateLimitWindow, $currentTime);

// Store bet info for reporting (to track if bet was placed)
$betInfoKey = "parser_bet_info:{$queueKey}:{$betId}";
$redis->setex($betInfoKey, 3600, json_encode([
    'client_id' => $clientId,
    'bet_id' => $betId,
    'parser_url' => $requestUri,
    'bet_data' => $availableBet,
    'timestamp' => $currentTime
]));

// Return the bet (encrypted if needed)
// Add bet_id and parser_url to bet data for tracking
$availableBet['_parser_bet_id'] = $betId;
$availableBet['_parser_url'] = $requestUri;
$availableBet['_parser_client_id'] = $clientId;

$responseData = [$availableBet];
$responseJson = json_encode($responseData);

if ($shouldDecrypt) {
    echo encrypt($responseJson);
} else {
    echo $responseJson;
}
