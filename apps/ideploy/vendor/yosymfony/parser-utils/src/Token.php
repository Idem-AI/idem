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

class Token
{
    protected $value;
    protected $name;
    protected $line;

    /**
     * Constructor.
     *
     * @param string $value The value of the token
     * @param string $name The name of the token. e.g: T_BRAKET_BEGIN
     * @param int $line Line of the code in where the token is found
     */
    public function __construct(string $value, string $name, int $line)
    {
        $this->value = $value;
        $this->name = $name;
        $this->line = $line;
    }

    /**
     * Returns the value (the match term)
     *
     * @return string
     */
    public function getValue() : string
    {
        return $this->value;
    }

    /**
     * Returns the name of the token
     *
     * @return string
     */
    public function getName() : string
    {
        return $this->name;
    }

    /**
     * Returns the line of the code in where the token is found
     *
     * @return int
     */
    public function getLine() : int
    {
        return $this->line;
    }

    public function __toString() : string
    {
        return sprintf(
            "[\n name: %s\n value:%s\n line: %s\n]",
            $this->name,
            $this->value,
            $this->line
        );
    }
}
