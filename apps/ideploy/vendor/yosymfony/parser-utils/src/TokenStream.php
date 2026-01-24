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

class TokenStream implements TokenStreamInterface
{
    protected $tokens;
    protected $index = -1;

    /**
     * Constructor
     *
     * @param Token[] List of tokens
     */
    public function __construct(array $tokens)
    {
        $this->tokens = $tokens;
    }

    /**
     * {@inheritdoc}
     */
    public function moveNext() : ?Token
    {
        return $this->tokens[++$this->index] ?? null;
    }

    /**
     * {@inheritdoc}
     */
    public function matchNext(string $tokenName) : string
    {
        $token = $this->moveNext();
        --$this->index;

        if ($token->getName() == $tokenName) {
            return $this->moveNext()->getValue();
        }

        throw new SyntaxErrorException(sprintf(
            'Syntax error: expected token with name "%s" instead of "%s" at line %s.',
            $tokenName,
            $token->getName(),
            $token->getLine()
        ));
    }

    /**
     * {@inheritdoc}
     */
    public function skipWhile(string $tokenName) : void
    {
        $this->skipWhileAny([$tokenName]);
    }

    /**
     * {@inheritdoc}
     */
    public function skipWhileAny(array $tokenNames) : void
    {
        while ($this->isNextAny($tokenNames)) {
            $this->moveNext();
        }
    }

    /**
     * {@inheritdoc}
     */
    public function isNext(string $tokenName) : bool
    {
        $token = $this->moveNext();
        --$this->index;

        if ($token === null) {
            return false;
        }

        return $token->getName() == $tokenName;
    }

    /**
     * {@inheritdoc}
     */
    public function isNextSequence(array $tokenNames) : bool
    {
        $result = true;
        $currentIndex = $this->index;

        foreach ($tokenNames as $tokenName) {
            $token = $this->moveNext();

            if ($token === null || $token->getName() != $tokenName) {
                $result = false;

                break;
            }
        }

        $this->index = $currentIndex;

        return $result;
    }

    /**
     * {@inheritdoc}
     */
    public function isNextAny(array $tokenNames) : bool
    {
        $token = $this->moveNext();
        --$this->index;

        if ($token === null) {
            return false;
        }

        foreach ($tokenNames as $tokenName) {
            if ($tokenName === $token->getName()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns all tokens
     *
     * @return token[] List of tokens
     */
    public function getAll() : array
    {
        return $this->tokens;
    }

    /**
     * {@inheritdoc}
     */
    public function hasPendingTokens() :bool
    {
        $tokenCount = count($this->tokens);

        if ($tokenCount == 0) {
            return false;
        }

        return $this->index < ($tokenCount - 1);
    }

    /**
     * {@inheritdoc}
     */
    public function reset() : void
    {
        $this->index = -1;
    }
}
