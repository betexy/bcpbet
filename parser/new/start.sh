#!/bin/bash

# Create log directory with proper permissions (run as root initially if needed)
# Since we're running as www user, try to create log dir or use stderr
mkdir -p /tmp/php-fpm-logs 2>/dev/null || true

# Create custom php-fpm.conf that redirects error_log
echo "[global]" > /var/www2/new/php-fpm-custom.conf
echo "error_log = /proc/self/fd/2" >> /var/www2/new/php-fpm-custom.conf
echo "pid = /tmp/php-fpm.pid" >> /var/www2/new/php-fpm-custom.conf
echo "include=/usr/local/etc/php-fpm.d/*.conf" >> /var/www2/new/php-fpm-custom.conf

# Create/update custom PHP-FPM pool config with listen on all interfaces
cp /usr/local/etc/php-fpm.d/www.conf /var/www2/new/www-custom.conf

# Fix listen address
sed -i 's|listen = 127.0.0.1:9000|listen = 0.0.0.0:9000|' /var/www2/new/www-custom.conf

# Fix user and group
sed -i 's|^user = www-data|user = www|' /var/www2/new/www-custom.conf
sed -i 's|^group = www-data|group = www|' /var/www2/new/www-custom.conf

# Start PHP-FPM in background using custom configs
php-fpm -D -y /var/www2/new/www-custom.conf --fpm-config /var/www2/new/php-fpm-custom.conf

# Wait a moment for PHP-FPM to start
sleep 2

# Start parserProxy.php (runs in foreground, blocking)
php /var/www2/new/parserProxy.php
