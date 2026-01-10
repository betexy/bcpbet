<?php

if (isset($_ENV['SERVICE_TAGS']) && strpos($_ENV['SERVICE_TAGS'], 'dev') !== false) {
    defined('YII_DEBUG') or define('YII_DEBUG', true);
    defined('YII_ENV') or define('YII_ENV', 'dev');
} else {
    defined('YII_DEBUG') or define('YII_DEBUG', false);
    defined('YII_ENV') or define('YII_ENV', 'prod');
}

if (isset($_ENV['NO_DEBUG_DB_WEB'])) {
    defined('NO_DEBUG_DB_WEB') or define('NO_DEBUG_DB_WEB', true);
} else {
    defined('NO_DEBUG_DB_WEB') or define('NO_DEBUG_DB_WEB', false);
}

if (isset($_ENV['NO_DEBUG_DB_CONSOLE'])) {
    defined('NO_DEBUG_DB_CONSOLE') or define('NO_DEBUG_DB_CONSOLE', true);
} else {
    defined('NO_DEBUG_DB_CONSOLE') or define('NO_DEBUG_DB_CONSOLE', false);
}
