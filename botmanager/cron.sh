#!/usr/bin/env bash
# Added a cronjob in a new crontab
#echo "* * * * * php /var/www/yii sims-manager/requests > /dev/null" > /home/www/crontab
#echo "* * * * * php /var/www/yii sims-manager/requests/bind-per-minute > /dev/null" >> /home/www/crontab
echo "*/2 * * * * php /var/www/yii bot-manager/rdp > /dev/null" >> /home/www/crontab
echo "*/2 * * * * php /var/www/yii bot-manager/rdp-install > /dev/null" >> /home/www/crontab
echo "*/2 * * * * php /var/www/yii bot-manager/rdp-install/guacamole > /dev/null" >> /home/www/crontab
echo "*/2 * * * * php /var/www/yii pay-systems/binance > /dev/null" >> /home/www/crontab
echo "*/2 * * * * php /var/www/yii pay-systems/binance/balances > /dev/null" >> /home/www/crontab
echo "*/5 * * * * php /var/www/yii bot-manager/stake > /dev/null" >> /home/www/crontab
supercronic /home/www/crontab
