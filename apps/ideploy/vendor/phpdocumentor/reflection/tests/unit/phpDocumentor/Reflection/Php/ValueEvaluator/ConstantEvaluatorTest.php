<?php

declare(strict_types=1);

namespace phpDocumentor\Reflection\Php\ValueEvaluator;

use phpDocumentor\Reflection\Php\Factory\ContextStack;
use phpDocumentor\Reflection\Php\Project;
use phpDocumentor\Reflection\Types\Context;
use PhpParser\ConstExprEvaluationException;
use PhpParser\Node\Expr\ShellExec;
use PhpParser\Node\Scalar\MagicConst\Namespace_;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(ConstantEvaluator::class)]
final class ConstantEvaluatorTest extends TestCase
{
    public function testEvaluateThrowsWhenTypeContextIsNotSet(): void
    {
        $this->expectException(ConstExprEvaluationException::class);

        $evaluator = new ConstantEvaluator();
        $evaluator->evaluate(new Namespace_(), new ContextStack(new Project('test')));
    }

    public function testEvaluateThrowsOnUnknownExpression(): void
    {
        $this->expectException(ConstExprEvaluationException::class);

        $evaluator = new ConstantEvaluator();
        $result = $evaluator->evaluate(new ShellExec([]), new ContextStack(new Project('test'), new Context('Test')));
    }

    public function testEvaluateReturnsNamespaceFromContext(): void
    {
        $evaluator = new ConstantEvaluator();
        $result = $evaluator->evaluate(new Namespace_(), new ContextStack(new Project('test'), new Context('Test')));

        self::assertSame('Test', $result);
    }
}
