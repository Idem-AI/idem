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

namespace phpDocumentor\Reflection\Php\Factory\File;

use phpDocumentor\Reflection\File\LocalFile;
use phpDocumentor\Reflection\Php\Factory\ContextStack;
use phpDocumentor\Reflection\Php\Project;
use phpDocumentor\Reflection\Php\ProjectFactoryStrategies;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(CreateCommand::class)]
#[UsesClass('phpDocumentor\Reflection\File\LocalFile')]
#[UsesClass('phpDocumentor\Reflection\Php\ProjectFactoryStrategies')]
class CreateCommandTest extends TestCase
{
    private CreateCommand $fixture;

    private LocalFile $file;

    private ProjectFactoryStrategies $strategies;

    protected function setUp(): void
    {
        $this->file       = new LocalFile(__FILE__);
        $this->strategies = new ProjectFactoryStrategies([]);
        $this->fixture    = new CreateCommand(
            new ContextStack(new Project('test')),
            $this->file,
            $this->strategies,
        );
    }

    public function testGetFile(): void
    {
        $this->assertSame($this->file, $this->fixture->getFile());
    }

    public function testGetStrategies(): void
    {
        $this->assertSame($this->strategies, $this->fixture->getStrategies());
    }
}
