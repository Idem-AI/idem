<?php

declare(strict_types=1);

/**
 * This file is part of phpDocumentor.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 *
 * @link http://phpdoc.org
 */

namespace phpDocumentor\Reflection\Php;

use phpDocumentor\Reflection\Types\Mixed_;
use phpDocumentor\Reflection\Types\String_;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

/**
 * Tests the functionality for the Argument class.
 */
#[CoversClass(Argument::class)]
final class ArgumentTest extends TestCase
{
    public function testGetTypes(): void
    {
        $argument = new Argument('myArgument', null, 'myDefaultValue', true, true);
        $this->assertInstanceOf(Mixed_::class, $argument->getType());

        $argument = new Argument(
            'myArgument',
            new String_(),
            'myDefaultValue',
            true,
            true,
        );
        $this->assertEquals(new String_(), $argument->getType());
    }

    public function testGetName(): void
    {
        $argument = new Argument('myArgument', null, 'myDefault', true, true);
        $this->assertEquals('myArgument', $argument->getName());
    }

    public function testGetDefault(): void
    {
        $argument = new Argument('myArgument', null, 'myDefaultValue', true, true);
        $this->assertEquals('myDefaultValue', $argument->getDefault());

        $argument = new Argument('myArgument', null, null, true, true);
        $this->assertNull($argument->getDefault());
    }

    public function testGetWhetherArgumentIsPassedByReference(): void
    {
        $argument = new Argument('myArgument', null, 'myDefaultValue', true, true);
        $this->assertTrue($argument->isByReference());

        $argument = new Argument('myArgument', null, null, false, true);
        $this->assertFalse($argument->isByReference());
    }

    public function testGetWhetherArgumentisVariadic(): void
    {
        $argument = new Argument('myArgument', null, 'myDefaultValue', true, true);
        $this->assertTrue($argument->isVariadic());

        $argument = new Argument('myArgument', null, 'myDefaultValue', true, false);
        $this->assertFalse($argument->isVariadic());
    }
}
