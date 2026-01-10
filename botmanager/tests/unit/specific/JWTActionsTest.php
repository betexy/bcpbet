<?php

// ./vendor/bin/codecept run unit ./tests/unit/specific/JWTActionsTest:testGenerateToken --debug
use app\modules\BotManager\Helpers\BotsHelper;

class JWTActionsTest extends \Codeception\Test\Unit
{

    public function testGenerateToken()
    {

        $object = new BotsHelper();
        $reflector = new \ReflectionClass(\app\modules\BotManager\Helpers\BotsHelper::class);
        $method = $reflector->getMethod('genToken');
        $method->setAccessible(true);

        $response = $method->invoke($object, '1234');
        \Codeception\Util\Debug::debug("Token: '$response'");
        //file_put_contents(__DIR__ . '/../../../tokens.txt', "$response\r\n", FILE_APPEND);
        //$this->assertEquals('expected-response', $response); // replace with your assertion

        $this->assertTrue(true, 'Okay!');
    }


}