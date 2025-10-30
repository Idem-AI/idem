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

use OutOfBoundsException;
use phpDocumentor\Reflection\Php\Factory\ContextStack;
use phpDocumentor\Reflection\Php\Factory\DummyFactoryStrategy;
use phpDocumentor\Reflection\Types\Context;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use stdClass;

/**
 * Test case for ProjectFactoryStrategies
 */
#[CoversClass(ProjectFactoryStrategies::class)]
class ProjectFactoryStrategiesTest extends TestCase
{
    public function testStrategiesAreChecked(): void
    {
        new ProjectFactoryStrategies([new DummyFactoryStrategy()]);
        $this->assertTrue(true);
    }

    public function testFindMatching(): void
    {
        $strategy  = new DummyFactoryStrategy();
        $container = new ProjectFactoryStrategies([$strategy]);
        $actual    = $container->findMatching(
            new ContextStack(new Project('name'), new Context('global')),
            new stdClass(),
        );

        $this->assertSame($strategy, $actual);
    }

    public function testCreateThrowsExceptionWhenStrategyNotFound(): void
    {
        $this->expectException(OutOfBoundsException::class);
        $container = new ProjectFactoryStrategies([]);
        $container->findMatching(
            new ContextStack(new Project('name'), new Context('global')),
            new stdClass(),
        );
    }
}
