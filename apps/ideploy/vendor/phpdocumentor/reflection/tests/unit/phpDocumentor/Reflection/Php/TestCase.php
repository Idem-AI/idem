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

use phpDocumentor\Reflection\Element;
use phpDocumentor\Reflection\Metadata\MetaDataContainer as MetaDataContainerInterface;
use PHPUnit\Framework\Attributes\CoversFunction;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\TestCase as BaseTestCase;

/**
 * Base test case for all elements.
 */
#[CoversFunction('getLocation')]
#[CoversFunction('getEndLocation')]
#[UsesClass('\phpDocumentor\Reflection\Location')]
abstract class TestCase extends BaseTestCase
{
    protected Element|MetaDataContainerInterface $fixture;

    public function testLineNumberIsMinusOneWhenNoneIsProvided(): void
    {
        $this->assertSame(-1, $this->fixture->getLocation()->getLineNumber());
        $this->assertSame(0, $this->fixture->getLocation()->getColumnNumber());

        $this->assertSame(-1, $this->fixture->getEndLocation()->getLineNumber());
        $this->assertSame(0, $this->fixture->getEndLocation()->getColumnNumber());
    }

    public function testLineAndColumnNumberIsReturnedWhenALocationIsProvided(): void
    {
    }

    protected function assertLineAndColumnNumberIsReturnedWhenALocationIsProvided(Element|MetaDataContainerInterface $fixture): void
    {
        $this->assertSame(100, $fixture->getLocation()->getLineNumber());
        $this->assertSame(20, $fixture->getLocation()->getColumnNumber());

        $this->assertSame(101, $fixture->getEndLocation()->getLineNumber());
        $this->assertSame(20, $fixture->getEndLocation()->getColumnNumber());
    }
}
