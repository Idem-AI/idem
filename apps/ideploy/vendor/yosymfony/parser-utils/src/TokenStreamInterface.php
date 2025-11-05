<?php
/*
 * This file is part of the Yosymfony\ParserUtils package.
 *
 * (c) YoSymfony <http://github.com/yosymfony>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
namespace Yosymfony\ParserUtils;

interface TokenStreamInterface
{
    /**
    * Moves the pointer one token forward
    *
    * @return Token|null The token or null if there are not more tokens
    */
    public function moveNext() : ?Token;

    /**
     * Matches the next token. This method moves the pointer one token forward
     * if an error does not occur
     *
     * @param string $tokenName The name of the token
     *
     * @return string The value of the token
     *
     * @throws SyntaxErrorException If the next token does not match
     */
    public function matchNext(string $tokenName) : string;

    /**
     * Skips tokens while they match with the token name passed as argument.
     * This method moves the pointer "n" tokens forward until the last one
     * that match with the token name
     *
     * @param string $tokenName The name of the token
     */
    public function skipWhile(string $tokenName) : void;

    /**
     * Skips tokens while they match with one of the token names passed as
     * argument. This method moves the pointer "n" tokens forward until the
     * last one that match with one of the token names
     *
     * @param string[] $tokenNames List of token names
     */
    public function skipWhileAny(array $tokenNames) : void;

    /**
     * Checks if the next token matches with the token name passed as argument
     *
     * @param string $tokenName The name of the token
     *
     * @return bool
     */
    public function isNext(string $tokenName) : bool;

    /**
     * Checks if the following tokens in the stream match with the sequence of tokens
     *
     * @param string[] $tokenNames Sequence of token names
     *
     * @return bool
     */
    public function isNextSequence(array $tokenNames) : bool;

    /**
     * Checks if one of the tokens passed as argument is the next token
     *
     * @param string[] $tokenNames List of token names. e.g: 'T_PLUS', 'T_SUB'
     *
     * @return bool
     */
    public function isNextAny(array $tokenNames) : bool;

    /**
     * Has pending tokens?
     *
     * @return bool
     */
    public function hasPendingTokens() :bool;

    /**
     * Resets the stream to the beginning
     */
    public function reset() : void;
}
