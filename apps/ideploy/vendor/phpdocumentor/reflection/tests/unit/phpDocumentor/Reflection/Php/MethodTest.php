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
use phpDocumentor\Reflection\Types\Mixed_;
use phpDocumentor\Reflection\Types\String_;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\UsesClass;

/** @property Method $fixture */
#[CoversClass(Method::class)]
#[UsesClass('\phpDocumentor\Reflection\Php\Visibility')]
#[UsesClass('\phpDocumentor\Reflection\Php\Argument')]
final class MethodTest extends TestCase
{
    use MetadataContainerTestHelper;

    private Fqsen $fqsen;

    private Visibility $visibility;

    private DocBlock $docblock;

    protected function setUp(): void
    {
        $this->fqsen = new Fqsen('\My\Space::MyMethod()');
        $this->visibility = new Visibility('private');
        $this->docblock = new DocBlock('');
        $this->fixture = new Method($this->fqsen);
    }

    private function getFixture(): MetaDataContainerInterface
    {
        return $this->fixture;
    }

    public function testGetFqsenAndGetName(): void
    {
        $method = new Method($this->fqsen);

        $this->assertSame($this->fqsen, $method->getFqsen());
        $this->assertEquals($this->fqsen->getName(), $method->getName());
    }

    public function testGetDocBlock(): void
    {
        $method = new Method($this->fqsen, $this->visibility, $this->docblock);

        $this->assertSame($this->docblock, $method->getDocBlock());
    }

    public function testAddingAndGettingArguments(): void
    {
        $method = new Method($this->fqsen);
        $this->assertEquals([], $method->getArguments());

        $argument = new Argument('myArgument');
        $method->addArgument($argument);

        $this->assertEquals([$argument], $method->getArguments());
    }

    public function testGettingWhetherMethodIsAbstract(): void
    {
        $method = new Method($this->fqsen, $this->visibility, $this->docblock, false);
        $this->assertFalse($method->isAbstract());

        $method = new Method($this->fqsen, $this->visibility, $this->docblock, true);
        $this->assertTrue($method->isAbstract());
    }

    public function testGettingWhetherMethodIsFinal(): void
    {
        $method = new Method($this->fqsen, $this->visibility, $this->docblock, false, false, false);
        $this->assertFalse($method->isFinal());

        $method = new Method($this->fqsen, $this->visibility, $this->docblock, false, false, true);
        $this->assertTrue($method->isFinal());
    }

    public function testGettingWhetherMethodIsStatic(): void
    {
        $method = new Method($this->fqsen, $this->visibility, $this->docblock, false, false, false);
        $this->assertFalse($method->isStatic());

        $method = new Method($this->fqsen, $this->visibility, $this->docblock, false, true, false);
        $this->assertTrue($method->isStatic());
    }

    public function testGettingVisibility(): void
    {
        $method = new Method($this->fqsen, $this->visibility, $this->docblock, false, false, false);
        $this->assertSame($this->visibility, $method->getVisibility());
    }

    public function testGetDefaultVisibility(): void
    {
        $method = new Method($this->fqsen);
        $this->assertEquals(new Visibility('public'), $method->getVisibility());
    }

    public function testGetDefaultReturnType(): void
    {
        $method = new Method($this->fqsen);
        $this->assertEquals(new Mixed_(), $method->getReturnType());
    }

    public function testGetReturnTypeFromConstructor(): void
    {
        $returnType = new String_();
        $method = new Method(
            $this->fqsen,
            new Visibility('public'),
            null,
            false,
            false,
            false,
            null,
            null,
            $returnType,
        );

        $this->assertSame($returnType, $method->getReturnType());
    }

    public function testGetHasReturnByReference(): void
    {
        $method = new Method($this->fqsen);
        $this->assertSame(false, $method->getHasReturnByReference());
    }

    public function testGetHasReturnByReferenceFromConstructor(): void
    {
        $method = new Method($this->fqsen, null, null, false, false, false, null, null, null, true);
        $this->assertSame(true, $method->getHasReturnByReference());
    }

    public function testLineAndColumnNumberIsReturnedWhenALocationIsProvided(): void
    {
        $fixture = new Method(
            $this->fqsen,
            null,
            null,
            false,
            false,
            false,
            new Location(100, 20),
            new Location(101, 20),
        );
        $this->assertLineAndColumnNumberIsReturnedWhenALocationIsProvided($fixture);
    }
}
