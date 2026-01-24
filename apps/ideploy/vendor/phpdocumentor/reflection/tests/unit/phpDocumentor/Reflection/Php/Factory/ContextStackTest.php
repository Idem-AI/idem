<?php

declare(strict_types=1);

namespace phpDocumentor\Reflection\Php\Factory;

use OutOfBoundsException;
use phpDocumentor\Reflection\Fqsen;
use phpDocumentor\Reflection\Php\Class_ as ClassElement;
use phpDocumentor\Reflection\Php\Method;
use phpDocumentor\Reflection\Php\Project;
use phpDocumentor\Reflection\Types\Context;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase as PHPUnitTestCase;

#[CoversClass(ContextStack::class)]
final class ContextStackTest extends PHPUnitTestCase
{
    public function testCreate(): void
    {
        $project = new Project('myProject');
        $typeContext = new Context('myNamespace');
        $context = new ContextStack($project, $typeContext);

        self::assertSame($project, $context->getProject());
        self::assertSame($typeContext, $context->getTypeContext());
    }

    public function testPeekThowsWhenEmpty(): void
    {
        $this->expectException(OutOfBoundsException::class);
        $project = new Project('myProject');
        $typeContext = new Context('myNamespace');
        $context = new ContextStack($project, $typeContext);

        $context->peek();
    }

    public function testPeekReturnsTopOfStack(): void
    {
        $class = new ClassElement(new Fqsen('\MyClass'));

        $project = new Project('myProject');
        $typeContext = new Context('myNamespace');
        $context = new ContextStack($project, $typeContext);
        $context = $context->push($class);

        self::assertSame($class, $context->peek());
        self::assertSame($project, $context->getProject());
        self::assertSame($typeContext, $context->getTypeContext());
    }

    public function testCreateWithTypeContext(): void
    {
        $class = new ClassElement(new Fqsen('\MyClass'));

        $project = new Project('myProject');
        $typeContext = new Context('myNamespace');
        $context = new ContextStack($project);
        $context = $context->push($class)->withTypeContext($typeContext);

        self::assertSame($class, $context->peek());
        self::assertSame($project, $context->getProject());
        self::assertSame($typeContext, $context->getTypeContext());
    }

    public function testSearchEmptyStackResultsInNull(): void
    {
        $project = new Project('myProject');
        $context = new ContextStack($project);

        self::assertNull($context->search(ClassElement::class));
    }

    public function testSearchStackForExistingElementTypeWillReturnTheFirstHit(): void
    {
        $class = new ClassElement(new Fqsen('\MyClass'));
        $project = new Project('myProject');
        $context = new ContextStack($project);
        $context = $context
            ->push(new ClassElement(new Fqsen('\OtherClass')))
            ->push($class)
            ->push(new Method(new Fqsen('\MyClass::method()')));

        self::assertSame($class, $context->search(ClassElement::class));
    }
}
