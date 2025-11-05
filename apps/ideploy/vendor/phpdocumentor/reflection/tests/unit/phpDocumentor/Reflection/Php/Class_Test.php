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
use phpDocumentor\Reflection\Location;
use phpDocumentor\Reflection\Metadata\MetaDataContainer as MetaDataContainerInterface;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\UsesClass;

/** @property Class_ $fixture */
#[CoversClass(Class_::class)]
#[UsesClass('\phpDocumentor\Reflection\Php\Property')]
#[UsesClass('\phpDocumentor\Reflection\Php\Constant')]
#[UsesClass('\phpDocumentor\Reflection\Php\Method')]
#[UsesClass('\phpDocumentor\Reflection\Php\Visibility')]
final class Class_Test extends TestCase
{
    use MetadataContainerTestHelper;

    private Fqsen $parent;

    private Fqsen $fqsen;

    private DocBlock $docBlock;

    /**
     * Creates a new (emoty) fixture object.
     */
    protected function setUp(): void
    {
        $this->parent = new Fqsen('\MyParentClass');
        $this->fqsen = new Fqsen('\MyClass');
        $this->docBlock = new DocBlock('');

        $this->fixture = new Class_($this->fqsen, $this->docBlock);
    }

    private function getFixture(): MetaDataContainerInterface
    {
        return $this->fixture;
    }

    public function testGettingName(): void
    {
        $this->assertSame($this->fqsen->getName(), $this->fixture->getName());
    }

    public function testGettingFqsen(): void
    {
        $this->assertSame($this->fqsen, $this->fixture->getFqsen());
    }

    public function testGettingDocBlock(): void
    {
        $this->assertSame($this->docBlock, $this->fixture->getDocBlock());
    }

    public function testGettingParent(): void
    {
        $class = new Class_($this->fqsen, $this->docBlock);
        $this->assertNull($class->getParent());

        $class = new Class_($this->fqsen, $this->docBlock, $this->parent);
        $this->assertSame($this->parent, $class->getParent());
    }

    public function testAddAndGettingInterfaces(): void
    {
        $this->assertEmpty($this->fixture->getInterfaces());

        $interface = new Fqsen('\MyInterface');

        $this->fixture->addInterface($interface);

        $this->assertSame(['\MyInterface' => $interface], $this->fixture->getInterfaces());
    }

    public function testAddAndGettingConstants(): void
    {
        $this->assertEmpty($this->fixture->getConstants());

        $constant = new Constant(new Fqsen('\MyClass::MY_CONSTANT'));

        $this->fixture->addConstant($constant);

        $this->assertSame(['\MyClass::MY_CONSTANT' => $constant], $this->fixture->getConstants());
    }

    public function testAddAndGettingProperties(): void
    {
        $this->assertEmpty($this->fixture->getProperties());

        $property = new Property(new Fqsen('\MyClass::$myProperty'));

        $this->fixture->addProperty($property);

        $this->assertSame(['\MyClass::$myProperty' => $property], $this->fixture->getProperties());
    }

    public function testAddAndGettingMethods(): void
    {
        $this->assertEmpty($this->fixture->getMethods());

        $method = new Method(new Fqsen('\MyClass::myMethod()'));

        $this->fixture->addMethod($method);

        $this->assertSame(['\MyClass::myMethod()' => $method], $this->fixture->getMethods());
    }

    public function testAddAndGettingUsedTrait(): void
    {
        $this->assertEmpty($this->fixture->getUsedTraits());

        $trait = new Fqsen('\MyTrait');

        $this->fixture->addUsedTrait($trait);

        $this->assertSame(['\MyTrait' => $trait], $this->fixture->getUsedTraits());
    }

    public function testGettingWhetherClassIsAbstract(): void
    {
        $class = new Class_($this->fqsen, $this->docBlock);
        $this->assertFalse($class->isAbstract());

        $class = new Class_($this->fqsen, $this->docBlock, null, true);
        $this->assertTrue($class->isAbstract());
    }

    public function testGettingWhetherClassIsFinal(): void
    {
        $class = new Class_($this->fqsen, $this->docBlock);
        $this->assertFalse($class->isFinal());

        $class = new Class_($this->fqsen, $this->docBlock, null, false, true);
        $this->assertTrue($class->isFinal());
    }

    public function testGettingWhetherClassIsReadOnly(): void
    {
        $class = new Class_($this->fqsen, $this->docBlock);
        $this->assertFalse($class->isReadOnly());

        $class = new Class_(
            $this->fqsen,
            $this->docBlock,
            null,
            false,
            false,
            null,
            null,
            true,
        );
        $this->assertTrue($class->isReadOnly());
    }

    public function testLineAndColumnNumberIsReturnedWhenALocationIsProvided(): void
    {
        $fixture = new Class_(
            $this->fqsen,
            $this->docBlock,
            null,
            false,
            false,
            new Location(100, 20),
            new Location(101, 20),
        );
        $this->assertLineAndColumnNumberIsReturnedWhenALocationIsProvided($fixture);
    }
}
