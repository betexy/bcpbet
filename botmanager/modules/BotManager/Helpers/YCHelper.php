<?php

namespace app\modules\BotManager\Helpers;

use app\modules\BotManager\models\RdpTable;
use Jose\Component\Core\AlgorithmManager;
use Jose\Component\Core\Util\JsonConverter;
use Jose\Component\KeyManagement\JWKFactory;
use Jose\Component\Signature\JWSBuilder;
use Jose\Component\Signature\Algorithm\PS256;
use Jose\Component\Signature\Serializer\CompactSerializer;

/**
 * Class YCHelper
 * @package app\modules\BotManager\Helpers
 *
 * WARNING!
 *
 * You need directly download from https://github.com/web-token/jwt-framework version 2.2
 * and put it into vendor dir, for ex. /vendor/web-token/jwt-framework/
 *
 */
class YCHelper
{
    private static $service_account_id = 'ajed4d2l0ntd0heo3au1';
    private static $key_id = 'aje9ijpi0on62f34loqq';
    private static $oAuths = [
        1 => 'AQAEA7qh9oyNAATuwf7GPU8KrkPbqU5Vj-nJt3c',
        2 => 'AQAAAAAB76pWAATuwbKNltJV4EksjcfLbef9lqs',
    ];

    public static function reboot($id)
    {
        $table = RdpTable::findOne(['id' => $id]);
        $table->last_yc_reboot_attempt = time();
        $table->save();
        $token = self::getIAM($table->yc_account);
        if (!empty($token) && strlen($token) > 35) {
            $ch = curl_init("https://compute.api.cloud.yandex.net/compute/v1/instances/{$table->yc_id}:restart");
            curl_setopt( $ch, CURLOPT_POST, true);
            curl_setopt( $ch, CURLOPT_HTTPHEADER, [
                'Content-Type:application/json',
                "Authorization: Bearer {$token}",
            ]);
            curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
            $result = curl_exec($ch);
            curl_close($ch);
            //echo "\n{$result}\n";
            $parsed = json_decode($result, true);
            if (empty($parsed['error']) && empty($parsed['code'])) {
                $table->last_yc_reboot = time();
                $table->save();
                return 'ok';
            } else {
                return $result;
            }
        } else {
            return "Error - no token '{$token}'!";
        }
    }

    /**
     * WARNING! You should execute curl https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
     * in the yiiapp and yiicron containers both!
     * @param $account
     * @return false|mixed|string|null
     */
    private static function getIAM($account)
    {
        $filename = dirname(__FILE__)."/iam_{$account}.token";
        if (file_exists($filename)) {
            $current = json_decode(file_get_contents($filename), true);
            if (!empty($current['created_at']) && (int)$current['created_at'] > time() - 3600) {
                return $current['iamToken'];
            }
        }
        if (file_exists($filename.'.process')) {
            return 'Error - token generation in progress!';
        }
        file_put_contents($filename.'.process', 'true');
        $started = microtime(true);
        $command = "/home/www/yandex-cloud/bin/yc config set token "
            . self::$oAuths[$account]
            ." && /home/www/yandex-cloud/bin/yc iam create-token";
        $iam = shell_exec($command);
        //echo "\nCommand:\n{$command}\n";
        if (!empty($iam)) {
            file_put_contents($filename, json_encode([
                'iamToken' => trim($iam),
                'created_at' => time(),
            ]));
        } else {
            $output=null;
            $retval=null;
            exec("whoami && /home/www/yandex-cloud/bin/yc", $output, $retval);
            $iam = var_export($output, true) . ' => ' . $retval;
            file_put_contents($filename . '.log', date('Y-m-d H:i:s') . ': empty $iam! '
                . $iam  . "\n", FILE_APPEND);
        }
        //echo "\nIAM generated:\n{$iam}\nIn ".(microtime(true) - $started)." s\n";
        unlink($filename.'.process');
        return $iam;
    }


    private static function getIAMthrowJWT()
    {
        $filename = dirname(__FILE__).'/iam.token';
        if (file_exists($filename)) {
            $current = json_decode(file_get_contents($filename), true);
            if (!empty($current['created_at']) && (int)$current['created_at'] > time() - 3600) {
                return $current['iamToken'];
            }
        }
        if (file_exists($filename.'.process')) {
            return '';
        }
        file_put_contents($filename.'.process', 'true');
        $started = microtime(true);
        $jwt = self::generateJWT();
        //echo "\nJWT generated:\n{$jwt}\n";
        $ch = curl_init('https://iam.api.cloud.yandex.net/iam/v1/tokens');
        $payload = json_encode(["jwt" => $jwt]);
        curl_setopt( $ch, CURLOPT_POSTFIELDS, $payload );
        curl_setopt( $ch, CURLOPT_HTTPHEADER, ['Content-Type:application/json']);
        curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
        $result = curl_exec($ch);
        curl_close($ch);
        unlink($filename.'.process');
        //echo "\nIAM generated:\n{$result}\nIn ".(microtime(true) - $started)." s\n";
        $parsed = json_decode($result, true);
        if (!empty($parsed['iamToken'])) {
            $parsed['created_at'] = time();
            file_put_contents($filename, json_encode($parsed));
            return $parsed['iamToken'];
        } else {
            return '';
        }
    }

    private static function generateJWT()
    {
        $jsonConverter = new JsonConverter();
        $algorithmManager = new AlgorithmManager([
            new PS256()
        ]);

        $jwsBuilder = new JWSBuilder($algorithmManager);

        $now = time();

        $claims = [
            'aud' => 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
            'iss' => self::$service_account_id,
            'iat' => $now,
            'exp' => $now + 1000
        ];

        $header = [
            'alg' => 'PS256',
            'typ' => 'JWT',
            'kid' => self::$key_id
        ];

        $key = JWKFactory::createFromKey('-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC88jPk0PhPIwss
NOE1tcCf0VCBAQVbBZZHjZlrZ++n7KrriQ7F4rnlWdqh2R3Oe6+ERy62gTk0mPW5
Wrh8/4wOYDRgMcGuY+/xj3aEjXEztYu70Svx3W+3CXfQUqyQLIF+KFAaQCp9jYEY
to5nYuhFMKDh2DIXPDYVPA6LZHM96+vOWlGgywhtN2vP3OSNQPwc3B9TGsCbzxG/
vrYzHVj+CBrZOSvsbGAko+//ELOgND7QtZQuZ+qouQUHtXmGYJ8FiSqzNhPUskLV
c/L4veUFYclSAm1efEnXuyIDNhBQWsYx2nlv0Dw/jIMwtmdFo41sZ0S65X+k0n8k
aSPUNv4FAgMBAAECggEALBTt2oKOjBgG8UddC6TdzeuNtqtATp4dE5CLrK1REoJ6
1fzh/3UIHeQ6x+vZsmTU7C2XTmkTqZvOKHJr/G26hVgYoCC7qS4Tuu3XntFJCeFf
OnBwqjsZZ0DEPUwsim53v7E0DwvNXgF3jwZ4btJ6kjnoLwi7lwQrMgUS95517IoJ
lzgwOlTL0QqAAzhKeuOMDzrpHZCda+uit6Q6HVMNHfNOady0ABxSL3XHibTmShZq
KFx+WlVbpHuvDtOUwaKqcKf31O8fs5WMi/Sdks2XoQ2QIdy7u5f74WHq3qwpJHo0
Bh+UIJHLmA0yp8XFLHvoIg7hrhj23oT+dt69NqCWOQKBgQDd4+0mdTWk3e852ayv
/C/aTCvMbDfShyxCFfrvCsoUvc1twTgseJP/uwjhafN9Wiox0SRylOW7EkFrSxQM
VJjyN9queUvkfLFw5kSt3BhyAKt7YkWYrZSBN7+KZB9GnjmHplgJQfQQFToFElWU
TzI+WbMCSHX63ww3+59AmmxorwKBgQDZ/dGJBctVECFvLbyENcAUiq/ZaC4fdqGy
Ckn1z5n7RKz9tVXrphGZYDJc+05NbejC+zyAFUcEQnZV8+e4c1JWyhd9LqXDNLAm
dgvqrRXJkZna428MvbOnpuJfhco1aM59/s7qd6GAnpJ48hG25a56NBsqjh4hskEn
pr4ZYhQJiwKBgDVEg2kJGFC06rozlG5HF2HLiXQwwpHq22geCLicGXkzO37OtOKQ
K89nojEjE04TeC+vapWLQz9OmZ/dTTnMkU8Ms5XRDrQSbzKQRQqL3N55ZLFhHR4T
BaSjsnrRoGR+lYcIGvhV+fZmciBHj33kKUaol/3DUXdhVniWElwa9k2HAoGAMQgz
WkOwYZi4PH6oGYDRjI1JUnhpb3BKnHZN/nlMpETlOEfSZKe866fEjD+GdEoVgc3q
5NBkYePlJB4xb76YtabNM74LUOYH/Q6uTYHTFbynQ6HGd7Ivt7UE1AGO4waI87Qd
rIVuETUZsxSXwXDWFuyjc6X1xxSGLToHJkR2R1MCgYEA2UCQXY/I3enMPMJffLp8
XeU+++RCi8Me+Quzj56f1N2brCsZ2WxBcq+wAqOi+NXYwNtiDiMNe/qLqR+is0+Q
jKPIM9fKzmZLoCA0fH8Mhvka788OHdl3lZcBf9JN/Rre5N5rg2RIOMTLQ+Kuy3gV
KK/5dz9sOviBr44x/aZDGUE=
-----END PRIVATE KEY-----');

        $payload = $jsonConverter->encode($claims);

        // Формирование подписи.
        $jws = $jwsBuilder
            ->create()
            ->withPayload($payload)
            ->addSignature($key, $header)
            ->build();

        $serializer = new CompactSerializer();

        // Формирование JWT.
        return $serializer->serialize($jws);
    }
}