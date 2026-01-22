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

/** @property Trait_ $fixture */
#[CoversClass(Trait_::class)]
#[UsesClass('\phpDocumentor\Reflection\Php\Property')]
#[UsesClass('\phpDocumentor\Reflection\Php\Visibility')]
#[UsesClass('\phpDocumentor\Reflection\Php\Method')]
final class Trait_Test extends TestCase
{
    use MetadataContainerTestHelper;

    private Fqsen $fqsen;

    private DocBlock $docBlock;

    /**
     * Creates a new (empty) fixture object.
     */
    protected function setUp(): void
    {
        $this->fqsen = new Fqsen('\MyTrait');
        $this->docBlock = new DocBlock('');
        $this->fixture = new Trait_($this->fqsen, $this->docBlock);
    }

    private function getFixture(): MetaDataContainerInterface
    {
        return $this->fixture;
    }

    public function testGetFqsenAndGetName(): void
    {
        $this->assertSame($this->fqsen, $this->fixture->getFqsen());
        $this->assertEquals($this->fqsen->getName(), $this->fixture->getName());
    }

    public function testAddAndGettingProperties(): void
    {
        $this->assertEquals([], $this->fixture->getProperties());

        $property = new Property(new Fqsen('\MyTrait::$myProperty'));

        $this->fixture->addProperty($property);

        $this->assertEquals(['\MyTrait::$myProperty' => $property], $this->fixture->getProperties());
    }

    public function testAddAndGettingMethods(): void
    {
        $this->assertEquals([], $this->fixture->getMethods());

        $method = new Method(new Fqsen('\MyTrait::myMethod()'));

        $this->fixture->addMethod($method);

        $this->assertEquals(['\MyTrait::myMethod()' => $method], $this->fixture->getMethods());
    }

    public function testAddAndGettingUsedTrait(): void
    {
        $this->assertEmpty($this->fixture->getUsedTraits());

        $trait = new Fqsen('\MyTrait');

        $this->fixture->addUsedTrait($trait);

        $this->assertSame(['\MyTrait' => $trait], $this->fixture->getUsedTraits());
    }

    public function testAddAndGettingConstants(): void
    {
        $this->assertEmpty($this->fixture->getConstants());

        $constant = new Constant(new Fqsen('\MyClass::MY_CONSTANT'));

        $this->fixture->addConstant($constant);

        $this->assertSame(['\MyClass::MY_CONSTANT' => $constant], $this->fixture->getConstants());
    }

    public function testGetDocblock(): void
    {
        $this->assertSame($this->docBlock, $this->fixture->getDocBlock());
    }

    public function testLineAndColumnNumberIsReturnedWhenALocationIsProvided(): void
    {
        $fixture = new Trait_($this->fqsen, $this->docBlock, new Location(100, 20), new Location(101, 20));
        $this->assertLineAndColumnNumberIsReturnedWhenALocationIsProvided($fixture);
    }
}
