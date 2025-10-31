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
use phpDocumentor\Reflection\Php\Class_ as ClassElement;
use phpDocumentor\Reflection\Php\File;
use phpDocumentor\Reflection\Php\Method as MethodElement;
use phpDocumentor\Reflection\Php\ProjectFactoryStrategy;
use phpDocumentor\Reflection\Php\StrategyContainer;
use PhpParser\Comment\Doc;
use PhpParser\Node\Name;
use PhpParser\Node\Stmt\Class_ as ClassNode;
use PhpParser\Node\Stmt\ClassMethod;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\UsesClass;
use Prophecy\Argument;
use Prophecy\PhpUnit\ProphecyTrait;
use Prophecy\Prophecy\ObjectProphecy;
use stdClass;

use function current;

#[CoversClass(Class_::class)]
#[CoversClass(AbstractFactory::class)]
#[UsesClass('\phpDocumentor\Reflection\Php\Class_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Constant')]
#[UsesClass('\phpDocumentor\Reflection\Php\Property')]
#[UsesClass('\phpDocumentor\Reflection\Php\Visibility')]
#[UsesClass('\phpDocumentor\Reflection\Php\Method')]
#[UsesClass('\phpDocumentor\Reflection\Php\Factory\ClassConstantIterator')]
#[UsesClass('\phpDocumentor\Reflection\Php\Factory\PropertyIterator')]
final class Class_Test extends TestCase
{
    use ProphecyTrait;

    private ObjectProphecy $docblockFactory;

    protected function setUp(): void
    {
        $this->docblockFactory = $this->prophesize(DocBlockFactoryInterface::class);
        $this->fixture = new Class_($this->docblockFactory->reveal());
    }

    public function testMatches(): void
    {
        $this->assertFalse($this->fixture->matches(self::createContext(null), new stdClass()));
        $this->assertTrue(
            $this->fixture->matches(
                self::createContext(null),
                $this->prophesize(ClassNode::class)->reveal(),
            ),
        );
    }

    public function testSimpleCreate(): void
    {
        $containerMock = m::mock(StrategyContainer::class);
        $classMock     = $this->buildClassMock();
        $classMock->shouldReceive('getDocComment')->andReturnNull();

        $class = $this->performCreate($classMock, $containerMock);

        $this->assertInstanceOf(ClassElement::class, $class);
        $this->assertEquals('\Space\MyClass', (string) $class->getFqsen());
        $this->assertNull($class->getParent());
        $this->assertTrue($class->isFinal());
        $this->assertTrue($class->isAbstract());
    }

    public function testClassWithParent(): void
    {
        $containerMock = m::mock(StrategyContainer::class);
        $classMock     = $this->buildClassMock();
        $classMock->shouldReceive('getDocComment')->andReturnNull();
        $classMock->extends = new Name('Space\MyParent');

        $class = $this->performCreate($classMock, $containerMock);

        $this->assertInstanceOf(ClassElement::class, $class);
        $this->assertEquals('\Space\MyClass', (string) $class->getFqsen());
        $this->assertEquals('\Space\MyParent', (string) $class->getParent());
    }

    public function testClassImplementingInterface(): void
    {
        $containerMock = m::mock(StrategyContainer::class);
        $classMock     = $this->buildClassMock();
        $classMock->shouldReceive('getDocComment')->andReturnNull();
        $classMock->extends    = new Name('Space\MyParent');
        $classMock->implements = [
            new Name('MyInterface'),
        ];

        $class = $this->performCreate($classMock, $containerMock);

        $this->assertInstanceOf(ClassElement::class, $class);
        $this->assertEquals('\Space\MyClass', (string) $class->getFqsen());

        $this->assertEquals(
            ['\MyInterface' => new Fqsen('\MyInterface')],
            $class->getInterfaces(),
        );
    }

    public function testIteratesStatements(): void
    {
        $method1           = new ClassMethod('MyClass::method1');
        $method1Descriptor = new MethodElement(new Fqsen('\MyClass::method1'));
        $strategyMock      = $this->prophesize(ProjectFactoryStrategy::class);
        $containerMock     = $this->prophesize(StrategyContainer::class);
        $classMock         = $this->buildClassMock();
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

        $class = $this->performCreate($classMock, $containerMock->reveal());

        $this->assertInstanceOf(ClassElement::class, $class);
        $this->assertEquals('\Space\MyClass', (string) $class->getFqsen());
        $this->assertEquals(
            ['\MyClass::method1' => $method1Descriptor],
            $class->getMethods(),
        );
    }

    public function testCreateWithDocBlock(): void
    {
        $doc       = new Doc('Text');
        $classMock = $this->buildClassMock();
        $classMock->shouldReceive('getDocComment')->andReturn($doc);
        $docBlock = new DocBlockElement('');
        $this->docblockFactory->create('Text', null)->willReturn($docBlock);
        $containerMock = m::mock(StrategyContainer::class);

        $class = $this->performCreate($classMock, $containerMock);

        $this->assertSame($docBlock, $class->getDocBlock());
    }

    private function buildClassMock(): m\MockInterface|ClassNode
    {
        $classMock = m::mock(ClassNode::class);
        $classMock->shouldReceive('getAttribute')->andReturn(new Fqsen('\Space\MyClass'));
        $classMock->implements = [];
        $classMock->stmts = [];
        $classMock->shouldReceive('isFinal')->andReturn(true);
        $classMock->shouldReceive('isAbstract')->andReturn(true);
        $classMock->shouldReceive('isReadonly')->andReturn(true);
        $classMock->shouldReceive('getLine')->andReturn(1);
        $classMock->shouldReceive('getEndLine')->andReturn(2);

        return $classMock;
    }

    private function performCreate(ClassNode $classMock, StrategyContainer $containerMock): ClassElement
    {
        $file = new File('hash', 'path');
        $this->fixture->create(self::createContext(null)->push($file), $classMock, $containerMock);

        return current($file->getClasses());
    }
}
