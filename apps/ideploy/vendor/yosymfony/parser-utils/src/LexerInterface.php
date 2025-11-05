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

/**
 * Interface for a lexer
 */
interface LexerInterface
{
    /**
     * Returns the tokens found
     *
     * @param string $input The input to be tokenized
     *
     * @return TokenStream The stream of tokens
     */
    public function tokenize(string $input) : TokenStream;
}
