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
use Yosymfony\ParserUtils\AbstractParser;
use Yosymfony\ParserUtils\BasicLexer;
use Yosymfony\ParserUtils\SyntaxErrorException;
use Yosymfony\ParserUtils\TokenStream;

class AbstractParserTest extends TestCase
{
    private $parser;

    public function setup()
    {
        $lexer = new BasicLexer([
            '/^([0-9]+)/x' => 'T_NUMBER',
            '/^(\+)/x' => 'T_PLUS',
            '/^(-)/x' => 'T_MINUS',
            '/^\s+/' => 'T_SPACE',
        ]);

        $this->parser = $this->getMockBuilder(AbstractParser::class)
            ->setConstructorArgs([$lexer])
            ->getMockForAbstractClass();
        $this->parser->expects($this->any())
            ->method('parseImplementation')
            ->will($this->returnCallback(function (TokenStream $stream) {
                $result = $stream->matchNext('T_NUMBER');

                while ($stream->isNextAny(['T_PLUS', 'T_MINUS'])) {
                    switch ($stream->moveNext()->getName()) {
                        case 'T_PLUS':
                            $result += $stream->matchNext('T_NUMBER');
                            break;
                        case 'T_MINUS':
                            $result -= $stream->matchNext('T_NUMBER');
                            break;
                        default:
                            throw new SyntaxErrorException("Something went wrong");
                            break;
                    }
                }

                return $result;
            }));
    }

    public function testParseMustReturnTheResultOfTheSum()
    {
        $this->assertEquals(2, $this->parser->parse('1 + 1'));
    }
}
