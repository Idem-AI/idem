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

use phpDocumentor\Reflection\Fqsen;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\TestCase;

/**
 * Tests the functionality for the Project class.
 */
#[CoversClass(Project::class)]
#[UsesClass('\phpDocumentor\Reflection\Php\Namespace_')]
#[UsesClass('\phpDocumentor\Reflection\Php\File')]
class ProjectTest extends TestCase
{
    final public const EXAMPLE_NAME = 'Initial name';

    private Project $fixture;

    /**
     * Initializes the fixture object.
     */
    protected function setUp(): void
    {
        $this->fixture = new Project(self::EXAMPLE_NAME);
    }

    public function testGetSetName(): void
    {
        $this->assertEquals(self::EXAMPLE_NAME, $this->fixture->getName());
    }

    public function testGetAddFiles(): void
    {
        $this->assertEmpty($this->fixture->getFiles());

        $include = new File('foo-bar', 'foo/bar');
        $this->fixture->addFile($include);

        $this->assertSame(['foo/bar' => $include], $this->fixture->getFiles());
    }

    public function testGetRootNamespace(): void
    {
        $this->assertInstanceOf(Namespace_::class, $this->fixture->getRootNamespace());

        $namespaceDescriptor = new Namespace_(new Fqsen('\MySpace'));
        $project             = new Project(self::EXAMPLE_NAME, $namespaceDescriptor);

        $this->assertSame($namespaceDescriptor, $project->getRootNamespace());
    }

    public function testGetAddNamespace(): void
    {
        $this->assertEmpty($this->fixture->getNamespaces());

        $namespace = new Namespace_(new Fqsen('\MySpace'));
        $this->fixture->addNamespace($namespace);

        $this->assertSame(['\MySpace' => $namespace], $this->fixture->getNamespaces());
    }
}
