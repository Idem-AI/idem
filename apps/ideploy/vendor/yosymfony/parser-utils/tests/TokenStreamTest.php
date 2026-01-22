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
use Yosymfony\ParserUtils\SyntaxErrorException;
use Yosymfony\ParserUtils\Token;
use Yosymfony\ParserUtils\TokenStream;

class TokenStreamTest extends TestCase
{
    public function testGetAllMustReturnsAllTokens()
    {
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
            new Token('1', 'T_NUMBER', 1),
        ]);

        $this->assertCount(2, $ts->getAll());
    }

    public function testMoveNextMustReturnsTheFirstTokenTheFirstTime()
    {
        $token = new Token('+', 'T_PLUS', 1);
        $ts = new TokenStream([
            $token,
        ]);

        $this->assertEquals($token, $ts->moveNext());
    }

    public function testMoveNextMustReturnsTheSecondTokenTheSecondTime()
    {
        $token = new Token('1', 'T_NUMBER', 1);
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
            $token,
        ]);
        $ts->moveNext();

        $this->assertEquals($token, $ts->moveNext());
    }

    public function testMoveNextMustReturnsWhenThereAreNotMoreTokens()
    {
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
        ]);
        $ts->moveNext();

        $this->assertNull($ts->moveNext());
    }

    public function testMoveNextMustReturnsTheFirstTokenAfterAReset()
    {
        $token = new Token('1', 'T_NUMBER', 1);
        $ts = new TokenStream([
            $token,
            new Token('+', 'T_PLUS', 1),
        ]);
        $ts->moveNext();
        $ts->moveNext();

        $ts->reset();

        $this->assertEquals($token, $ts->moveNext());
    }

    public function testMatchNextMustReturnMatchValueWhenTheNameOfNextTokenMatchWithTheNamePassed()
    {
        $token = new Token('1', 'T_NUMBER', 1);
        $ts = new TokenStream([
            $token,
        ]);

        $this->assertEquals('1', $ts->matchNext('T_NUMBER'));
    }

    public function testMatchNextMustThrowExceptionWhenTheNameOfNextTokenDoesNotMatchWithTheNamePassed()
    {
        $this->expectException(SyntaxErrorException::class);
        $this->expectExceptionMessage('Syntax error: expected token with name "T_PLUS" instead of "T_NUMBER" at line 1.');

        $token = new Token('1', 'T_NUMBER', 1);
        $ts = new TokenStream([
            $token,
        ]);

        $ts->matchNext('T_PLUS');
    }

    public function testIsNextMustReturnsTrueWhenTheNameOfNextTokenMatchWithTheNamePassed()
    {
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
            new Token('1', 'T_NUMBER', 1),
        ]);

        $ts->moveNext();

        $this->assertTrue($ts->isNext('T_NUMBER'));
    }

    public function testIsNextMustReturnsTrueWhenTheNameOfNextTokenMatchWithTheNamePassedAtTheBeginning()
    {
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
            new Token('1', 'T_NUMBER', 1),
        ]);

        $this->assertTrue($ts->isNext('T_PLUS'));
    }

    public function testIsNextMustReturnsFalseWhenTheNameOfNextTokenDoesNotMatchWithTheNamePassed()
    {
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
            new Token('1', 'T_NUMBER', 1),
        ]);

        $this->assertFalse($ts->isNext('T_NUMBER'));
    }

    public function testIsNextMustNotAlterTheTokenStream()
    {
        $token = new Token('+', 'T_PLUS', 1);
        $ts = new TokenStream([
            $token,
            new Token('1', 'T_NUMBER', 1),
        ]);
        $ts->isNext('T_PLUS');

        $this->assertEquals($token, $ts->moveNext(), 'The next token must be T_PLUS');
    }

    public function testIsNextSequenceMustReturnTrueWhenTheFollowingTokensInTheStreamMatchWithSequence()
    {
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
            new Token('1', 'T_NUMBER', 1),
        ]);

        $this->assertTrue($ts->isNextSequence(['T_PLUS', 'T_NUMBER']));
    }

    public function testIsNextSequenceMustReturnFalseWhenTheFollowingTokensInTheStreamDoesNotMatchWithSequence()
    {
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
            new Token('1', 'T_NUMBER', 1),
        ]);

        $this->assertFalse($ts->isNextSequence(['T_NUMBER', 'T_PLUS']));
    }

    public function testIsNextSequenceMustNotAlterTheTokenStream()
    {
        $token = new Token('+', 'T_PLUS', 1);
        $ts = new TokenStream([
            $token,
            new Token('1', 'T_NUMBER', 1),
        ]);
        $ts->isNextSequence(['T_NUMBER', 'T_PLUS']);

        $this->assertEquals($token, $ts->moveNext(), 'The next token must be T_PLUS');
    }

    public function testIsNextAnyMustReturnTrueWhenNameOfNextTokenMatchWithOneOfTheList()
    {
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
            new Token('1', 'T_NUMBER', 1),
        ]);

        $this->assertTrue($ts->isNextAny(['T_MINUS', 'T_PLUS']));
    }

    public function testIsNextAnyMustReturnFalseWhenNameOfNextTokenDoesNotMatchWithOneOfTheList()
    {
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
            new Token('1', 'T_NUMBER', 1),
        ]);

        $this->assertFalse($ts->isNextAny(['T_DIV', 'T_MINUS']));
    }

    public function testIsNextAnyMustNotAlterTheTokenStream()
    {
        $token = new Token('+', 'T_PLUS', 1);
        $ts = new TokenStream([
            $token,
            new Token('1', 'T_NUMBER', 1),
        ]);
        $ts->isNextAny(['T_MINUS', 'T_PLUS']);

        $this->assertEquals($token, $ts->moveNext(), 'The next token must be T_PLUS');
    }

    public function testHasPendingTokensMustReturnTrueWhenThereArePendingTokens()
    {
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
        ]);

        $this->assertTrue($ts->hasPendingTokens());
    }

    public function testHasPendingTokensMustReturnFalseWhenTokenStreamIsEmpty()
    {
        $ts = new TokenStream([]);

        $this->assertFalse($ts->hasPendingTokens());
    }

    public function testHasPendingTokensMustReturnFalseAfterPointingToTheLastToken()
    {
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
        ]);

        $ts->moveNext();

        $this->assertFalse($ts->hasPendingTokens());
    }

    public function testSkipWhileMustMovesPointerNTokensForwardUtilLastOneInstanceOfToken()
    {
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
            new Token('+', 'T_PLUS', 1),
            new Token('1', 'T_NUMBER', 1),
        ]);

        $ts->skipWhile('T_PLUS');

        $this->assertTrue($ts->isNext('T_NUMBER'));
    }

    public function testSkipWhileAnyMustMovesPointerNTokensForwardUtilLastOneInstanceOfOneOfAnyTokens()
    {
        $ts = new TokenStream([
            new Token('+', 'T_PLUS', 1),
            new Token('+', 'T_PLUS', 1),
            new Token('+', 'T_MINUS', 1),
            new Token('1', 'T_NUMBER', 1),
        ]);

        $ts->skipWhileAny(['T_PLUS', 'T_MINUS']);

        $this->assertTrue($ts->isNext('T_NUMBER'));
    }
}
