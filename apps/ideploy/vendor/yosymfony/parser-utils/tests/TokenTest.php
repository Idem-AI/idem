<?php
/*
 * This file is part of the Yosymfony\ParserUtils package.
 *
 * (c) YoSymfony <http://github.com/yosymfony>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Yosymfony\ParserUtils\Test;

use PHPUnit\Framework\TestCase;
use Yosymfony\ParserUtils\Token;

class TokenTest extends TestCase
{
    public function testConstructorMustSetMatchAndNameAndLine()
    {
        $token = new Token('+', 'T_PLUS', 1);

        $this->assertEquals('+', $token->getValue());
        $this->assertEquals('T_PLUS', $token->getName());
        $this->assertEquals(1, $token->getLine());
    }
}
