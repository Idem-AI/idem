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

/** @property Enum_ $fixture */
#[CoversClass(Enum_::class)]
#[UsesClass('\phpDocumentor\Reflection\Php\Method')]
#[UsesClass('\phpDocumentor\Reflection\Php\EnumCase')]
final class Enum_Test extends TestCase
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
        $this->parent = new Fqsen('\MyParentEnum');
        $this->fqsen = new Fqsen('\Enum');
        $this->docBlock = new DocBlock('');

        $this->fixture = new Enum_($this->fqsen, null, $this->docBlock);
    }

    private function getFixture(): MetaDataContainerInterface
    {
        return $this->fixture;
    }

    public function testGettingName(): void
    {
        $this->assertSame($this->fqsen->getName(), $this->fixture->getName());
    }

    public function testGetBackedWithOutType(): void
    {
        $this->assertNull($this->fixture->getBackedType());
    }

    public function testGettingFqsen(): void
    {
        $this->assertSame($this->fqsen, $this->fixture->getFqsen());
    }

    public function testGettingDocBlock(): void
    {
        $this->assertSame($this->docBlock, $this->fixture->getDocBlock());
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

        $constant = new Constant(new Fqsen('\MyClass::MYCONST'));

        $this->fixture->addConstant($constant);

        $this->assertSame(['\MyClass::MYCONST' => $constant], $this->fixture->getConstants());
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

    public function testAddAndGettingCases(): void
    {
        $this->assertEmpty($this->fixture->getCases());

        $case = new EnumCase(new Fqsen('\MyEnum::VALUE'), null);

        $this->fixture->addCase($case);

        $this->assertSame(['\MyEnum::VALUE' => $case], $this->fixture->getCases());
    }

    public function testLineAndColumnNumberIsReturnedWhenALocationIsProvided(): void
    {
        $fixture = new Enum_($this->fqsen, null, $this->docBlock, new Location(100, 20), new Location(101, 20));
        $this->assertLineAndColumnNumberIsReturnedWhenALocationIsProvided($fixture);
    }
}
