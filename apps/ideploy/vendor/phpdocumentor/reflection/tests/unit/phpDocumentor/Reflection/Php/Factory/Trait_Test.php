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

namespace phpDocumentor\Reflection\Php\Factory;

use Mockery as m;
use phpDocumentor\Reflection\DocBlock as DocBlockElement;
use phpDocumentor\Reflection\DocBlockFactoryInterface;
use phpDocumentor\Reflection\Fqsen;
use phpDocumentor\Reflection\Php\File;
use phpDocumentor\Reflection\Php\Method as MethodElement;
use phpDocumentor\Reflection\Php\ProjectFactoryStrategy;
use phpDocumentor\Reflection\Php\StrategyContainer;
use phpDocumentor\Reflection\Php\Trait_ as TraitElement;
use PhpParser\Comment\Doc;
use PhpParser\Node\Stmt\ClassMethod;
use PhpParser\Node\Stmt\Trait_ as TraitNode;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\UsesClass;
use Prophecy\Argument;
use Prophecy\PhpUnit\ProphecyTrait;
use Prophecy\Prophecy\ObjectProphecy;
use stdClass;

use function current;

#[CoversClass(Trait_::class)]
#[CoversClass(Trait_::class)]
#[CoversClass(AbstractFactory::class)]
#[UsesClass('\phpDocumentor\Reflection\Php\Trait_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Method')]
#[UsesClass('\phpDocumentor\Reflection\Php\Visibility')]
#[UsesClass('\phpDocumentor\Reflection\Php\Property')]
#[UsesClass('\phpDocumentor\Reflection\Php\Factory\PropertyIterator')]
final class Trait_Test extends TestCase
{
    use ProphecyTrait;

    private ObjectProphecy $docBlockFactory;

    protected function setUp(): void
    {
        $this->docBlockFactory = $this->prophesize(DocBlockFactoryInterface::class);
        $this->fixture = new Trait_($this->docBlockFactory->reveal());
    }

    public function testMatches(): void
    {
        $this->assertFalse($this->fixture->matches(self::createContext(null), new stdClass()));
        $this->assertTrue($this->fixture->matches(self::createContext(null), m::mock(TraitNode::class)));
    }

    public function testSimpleCreate(): void
    {
        $containerMock = m::mock(StrategyContainer::class);
        $interfaceMock = $this->buildTraitMock();
        $interfaceMock->shouldReceive('getDocComment')->andReturnNull();

        $trait = $this->performCreate($interfaceMock, $containerMock);

        $this->assertInstanceOf(TraitElement::class, $trait);
        $this->assertEquals('\Space\MyTrait', (string) $trait->getFqsen());
    }

    public function testIteratesStatements(): void
    {
        $method1           = new ClassMethod('\Space\MyTrait::method1');
        $method1Descriptor = new MethodElement(new Fqsen('\Space\MyTrait::method1'));
        $strategyMock      = $this->prophesize(ProjectFactoryStrategy::class);
        $containerMock     = $this->prophesize(StrategyContainer::class);
        $classMock         = $this->buildTraitMock();
        $classMock->shouldReceive('getDocComment')->andReturnNull();
        $classMock->stmts = [$method1];

        $strategyMock->create(Argument::type(ContextStack::class), $method1, $containerMock)
            ->will(function ($args) use ($method1Descriptor): void {
                $args[0]->peek()->addMethod($method1Descriptor);
            })
            ->shouldBeCalled();

        $containerMock->findMatching(
            Argument::type(ContextStack::class),
            $method1,
        )->willReturn($strategyMock->reveal());

        $trait = $this->performCreate($classMock, $containerMock->reveal());

        $this->assertEquals('\Space\MyTrait', (string) $trait->getFqsen());
        $this->assertEquals(
            ['\Space\MyTrait::method1' => $method1Descriptor],
            $trait->getMethods(),
        );
    }

    public function testCreateWithDocBlock(): void
    {
        $doc       = new Doc('Text');
        $traitMock = $this->buildTraitMock();
        $traitMock->shouldReceive('getDocComment')->andReturn($doc);
        $docBlock = new DocBlockElement('');
        $this->docBlockFactory->create('Text', null)->willReturn($docBlock);
        $containerMock = m::mock(StrategyContainer::class);

        $trait = $this->performCreate($traitMock, $containerMock);

        $this->assertSame($docBlock, $trait->getDocBlock());
    }

    private function buildTraitMock(): m\MockInterface|TraitNode
    {
        $mock = m::mock(TraitNode::class);
        $mock->shouldReceive('getAttribute')->andReturn(new Fqsen('\Space\MyTrait'));
        $mock->stmts = [];
        $mock->shouldReceive('getLine')->andReturn(1);
        $mock->shouldReceive('getEndLine')->andReturn(2);

        return $mock;
    }

    private function performCreate(TraitNode $traitNode, StrategyContainer $containerMock): TraitElement
    {
        $file = new File('hash', 'path');
        $this->fixture->create(self::createContext(null)->push($file), $traitNode, $containerMock);

        return current($file->getTraits());
    }
}
