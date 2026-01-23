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

use phpDocumentor\Reflection\DocBlock;
use phpDocumentor\Reflection\Fqsen;
use phpDocumentor\Reflection\Metadata\MetaDataContainer as MetaDataContainerInterface;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(File::class)]
#[UsesClass('\phpDocumentor\Reflection\Php\Trait_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Interface_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Class_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Namespace_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Function_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Constant')]
#[UsesClass('\phpDocumentor\Reflection\Php\Visibility')]
final class FileTest extends TestCase
{
    use MetadataContainerTestHelper;

    public const EXAMPLE_HASH = 'a-hash-string';

    public const EXAMPLE_NAME = 'a-path-string';

    public const EXAMPLE_PATH = 'example/' . self::EXAMPLE_NAME;

    public const EXAMPLE_SOURCE = 'a-source-string';

    protected File $fixture;

    private DocBlock $docBlock;

    /**
     * Creates a new (emoty) fixture object.
     */
    protected function setUp(): void
    {
        $this->docBlock = new DocBlock('');

        $this->fixture = new File(self::EXAMPLE_HASH, self::EXAMPLE_PATH, self::EXAMPLE_SOURCE, $this->docBlock);
    }

    private function getFixture(): MetaDataContainerInterface
    {
        return $this->fixture;
    }

    public function testAddAndGetClasses(): void
    {
        $this->assertEmpty($this->fixture->getClasses());

        $class = new Class_(new Fqsen('\MySpace\MyClass'));
        $this->fixture->addClass($class);

        $this->assertEquals(['\MySpace\MyClass' => $class], $this->fixture->getClasses());
    }

    public function testAddAndGetConstants(): void
    {
        $this->assertEmpty($this->fixture->getConstants());

        $constant = new Constant(new Fqsen('\MySpace::MY_CONSTANT'));
        $this->fixture->addConstant($constant);

        $this->assertEquals(['\MySpace::MY_CONSTANT' => $constant], $this->fixture->getConstants());
    }

    public function testAddAndGetFunctions(): void
    {
        $this->assertEmpty($this->fixture->getFunctions());

        $function = new Function_(new Fqsen('\MySpace::MyFunction()'));
        $this->fixture->addFunction($function);

        $this->assertEquals(['\MySpace::MyFunction()' => $function], $this->fixture->getFunctions());
    }

    public function testAddAndGetInterfaces(): void
    {
        $this->assertEmpty($this->fixture->getInterfaces());

        $interface = new Interface_(new Fqsen('\MySpace\MyInterface'), []);
        $this->fixture->addInterface($interface);

        $this->assertEquals(['\MySpace\MyInterface' => $interface], $this->fixture->getInterfaces());
    }

    public function testAddAndGetTraits(): void
    {
        $this->assertEmpty($this->fixture->getTraits());

        $trait = new Trait_(new Fqsen('\MySpace\MyTrait'));
        $this->fixture->addTrait($trait);

        $this->assertEquals(['\MySpace\MyTrait' => $trait], $this->fixture->getTraits());
    }

    public function testAddAndGetEnums(): void
    {
        $this->assertEmpty($this->fixture->getEnums());

        $enum = new Enum_(new Fqsen('\MySpace\MyEnum'), null);
        $this->fixture->addEnum($enum);

        $this->assertEquals(['\MySpace\MyEnum' => $enum], $this->fixture->getEnums());
    }

    public function testGetDocBlock(): void
    {
        $this->assertSame($this->docBlock, $this->fixture->getDocBlock());
    }

    public function testGetHash(): void
    {
        $this->assertSame(self::EXAMPLE_HASH, $this->fixture->getHash());
    }

    public function testGetName(): void
    {
        $this->assertSame(self::EXAMPLE_NAME, $this->fixture->getName());
    }

    public function testSetAndGetPath(): void
    {
        $this->assertSame(self::EXAMPLE_PATH, $this->fixture->getPath());
    }

    public function testSetAndGetSource(): void
    {
        $this->assertSame(self::EXAMPLE_SOURCE, $this->fixture->getSource());
    }

    public function testSetAndGetNamespaceAliases(): void
    {
        $this->assertEmpty($this->fixture->getNamespaces());

        $this->fixture->addNamespace(new Fqsen('\MyNamepace\Foo'));

        $this->assertEquals(['\MyNamepace\Foo' => new Fqsen('\MyNamepace\Foo')], $this->fixture->getNamespaces());
    }

    public function testAddAndGetIncludes(): void
    {
        $this->assertEmpty($this->fixture->getIncludes());

        $include = self::EXAMPLE_PATH;
        $this->fixture->addInclude($include);

        $this->assertSame([self::EXAMPLE_PATH => self::EXAMPLE_PATH], $this->fixture->getIncludes());
    }
}
