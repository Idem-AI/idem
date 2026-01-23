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
 * Exception thrown when an error occurs during parsing or tokenizing
 */
class SyntaxErrorException extends \RuntimeException
{
    protected $token;

    /**
     * Constructor
     *
     * @param string $message The error messsage
     * @param Token|null $token The token
     * @param \Exception|null $previous The previous exceptio
     */
    public function __construct(string $message, Token $token = null, \Exception $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }

    /**
     * Sets the token associated to the exception
     *
     * @param Token $token The token
     */
    public function setToken(Token $token) : void
    {
        $this->token = $token;
    }

    /**
     * Returns the token associated to the exception
     *
     * @return Token|null
     */
    public function getToken() : ?Token
    {
        return $this->token;
    }
}
