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

use Mockery\Adapter\Phpunit\MockeryTestCase;
use OutOfBoundsException;
use phpDocumentor\Reflection\Exception;
use phpDocumentor\Reflection\File\LocalFile;
use phpDocumentor\Reflection\Fqsen;
use phpDocumentor\Reflection\Php\Factory\ContextStack;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\UsesClass;
use Prophecy\Argument as ProphesizeArgument;
use Prophecy\PhpUnit\ProphecyTrait;

use function array_keys;
use function assert;
use function current;
use function key;
use function md5;

#[CoversClass(ProjectFactory::class)]
#[UsesClass('\phpDocumentor\Reflection\Php\Project')]
#[UsesClass('\phpDocumentor\Reflection\Php\Namespace_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Class_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Interface_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Trait_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Constant')]
#[UsesClass('\phpDocumentor\Reflection\Php\File')]
#[UsesClass('\phpDocumentor\Reflection\Php\Function_')]
#[UsesClass('\phpDocumentor\Reflection\Php\ProjectFactoryStrategies')]
#[UsesClass('\phpDocumentor\Reflection\Php\Visibility')]
#[UsesClass('\phpDocumentor\Reflection\Middleware\ChainFactory')]
#[UsesClass('\phpDocumentor\Reflection\Php\Factory\Property')]
#[UsesClass('\phpDocumentor\Reflection\Php\Factory\Method')]
#[UsesClass('\phpDocumentor\Reflection\Php\Factory\Class_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Factory\Interface_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Factory\ClassConstant')]
#[UsesClass('\phpDocumentor\Reflection\Php\Factory\Define')]
#[UsesClass('\phpDocumentor\Reflection\Php\Factory\GlobalConstant')]
#[UsesClass('\phpDocumentor\Reflection\Php\Factory\Trait_')]
#[UsesClass('\phpDocumentor\Reflection\Php\Factory\File')]
#[UsesClass('\phpDocumentor\Reflection\Php\NodesFactory')]
final class ProjectFactoryTest extends MockeryTestCase
{
    use ProphecyTrait;

    public function testCreatingAnInstanceInstantiatesItWithTheRecommendedStrategies(): void
    {
        $this->assertInstanceOf(ProjectFactory::class, ProjectFactory::createInstance());
    }

    public function testCreate(): void
    {
        $expected = ['some/file.php', 'some/other.php'];
        $calls = 0;
        $someOtherStrategy = $this->prophesize(ProjectFactoryStrategy::class);
        $someOtherStrategy->matches(
            ProphesizeArgument::type(ContextStack::class),
            ProphesizeArgument::any(),
        )->willReturn(false);

        $someOtherStrategy->create(
            ProphesizeArgument::any(),
            ProphesizeArgument::any(),
            ProphesizeArgument::any(),
        )->shouldNotBeCalled();

        $fileStrategyMock = $this->prophesize(ProjectFactoryStrategy::class);
        $fileStrategyMock->matches(
            ProphesizeArgument::type(ContextStack::class),
            ProphesizeArgument::any(),
        )->willReturn(true);

        $fileStrategyMock->create(
            ProphesizeArgument::type(ContextStack::class),
            ProphesizeArgument::type(LocalFile::class),
            ProphesizeArgument::any(),
        )->will(function ($args) use (&$calls, $expected): void {
            $context = $args[0];
            assert($context instanceof ContextStack);

            $file = $args[1];
            assert($file instanceof LocalFile);
            $context->getProject()->addFile(new File($file->md5(), $expected[$calls++]));
        });

        $projectFactory = new ProjectFactory([$someOtherStrategy->reveal(), $fileStrategyMock->reveal()]);

        $files = [new LocalFile(__FILE__), new LocalFile(__FILE__)];
        $project = $projectFactory->create('MyProject', $files);

        $this->assertInstanceOf(Project::class, $project);

        $projectFilePaths = array_keys($project->getFiles());
        $this->assertEquals(['some/file.php', 'some/other.php'], $projectFilePaths);
    }

    public function testCreateThrowsExceptionWhenStrategyNotFound(): void
    {
        $this->expectException(OutOfBoundsException::class);
        $projectFactory = new ProjectFactory([]);
        $projectFactory->create('MyProject', ['aa']);
    }

    public function testCreateProjectFromFileWithNamespacedClass(): void
    {
        $file = new File(md5('some/file.php'), 'some/file.php');
        $file->addNamespace(new Fqsen('\mySpace'));
        $file->addClass(new Class_(new Fqsen('\mySpace\MyClass')));

        $namespaces = $this->fetchNamespacesFromSingleFile($file);

        $this->assertEquals('\mySpace', key($namespaces));

        $mySpace = current($namespaces);

        $this->assertInstanceOf(Namespace_::class, $mySpace);
        $this->assertEquals('\mySpace\MyClass', key($mySpace->getClasses()));
    }

    public function testWithNamespacedInterface(): void
    {
        $file = new File(md5('some/file.php'), 'some/file.php');
        $file->addNamespace(new Fqsen('\mySpace'));
        $file->addInterface(new Interface_(new Fqsen('\mySpace\MyInterface')));

        $namespaces = $this->fetchNamespacesFromSingleFile($file);

        $mySpace = current($namespaces);

        $this->assertInstanceOf(Namespace_::class, $mySpace);
        $this->assertEquals('\mySpace\MyInterface', key($mySpace->getInterfaces()));
    }

    public function testWithNamespacedFunction(): void
    {
        $file = new File(md5('some/file.php'), 'some/file.php');
        $file->addNamespace(new Fqsen('\mySpace'));
        $file->addFunction(new Function_(new Fqsen('\mySpace\function()')));

        $namespaces = $this->fetchNamespacesFromSingleFile($file);

        $mySpace = current($namespaces);

        $this->assertInstanceOf(Namespace_::class, $mySpace);
        $this->assertEquals('\mySpace\function()', key($mySpace->getFunctions()));
    }

    public function testWithNamespacedConstant(): void
    {
        $file = new File(md5('some/file.php'), 'some/file.php');
        $file->addNamespace(new Fqsen('\mySpace'));
        $file->addConstant(new Constant(new Fqsen('\mySpace::MY_CONST')));

        $namespaces = $this->fetchNamespacesFromSingleFile($file);

        $mySpace = current($namespaces);

        $this->assertInstanceOf(Namespace_::class, $mySpace);
        $this->assertEquals('\mySpace::MY_CONST', key($mySpace->getConstants()));
    }

    public function testWithNamespacedTrait(): void
    {
        $file = new File(md5('some/file.php'), 'some/file.php');
        $file->addNamespace(new Fqsen('\mySpace'));
        $file->addTrait(new Trait_(new Fqsen('\mySpace\MyTrait')));

        $namespaces = $this->fetchNamespacesFromSingleFile($file);

        $mySpace = current($namespaces);

        $this->assertInstanceOf(Namespace_::class, $mySpace);
        $this->assertEquals('\mySpace\MyTrait', key($mySpace->getTraits()));
    }

    public function testNamespaceSpreadOverMultipleFiles(): void
    {
        $someFile = new File(md5('some/file.php'), 'some/file.php');
        $someFile->addNamespace(new Fqsen('\mySpace'));
        $someFile->addClass(new Class_(new Fqsen('\mySpace\MyClass')));

        $otherFile = new File(md5('some/other.php'), 'some/other.php');
        $otherFile->addNamespace(new Fqsen('\mySpace'));
        $otherFile->addClass(new Class_(new Fqsen('\mySpace\OtherClass')));

        $namespaces = $this->fetchNamespacesFromMultipleFiles([$otherFile, $someFile]);

        $this->assertCount(1, $namespaces);
        $this->assertCount(2, current($namespaces)->getClasses());
    }

    public function testSingleFileMultipleNamespaces(): void
    {
        $someFile = new File(md5('some/file.php'), 'some/file.php');
        $someFile->addNamespace(new Fqsen('\mySpace'));
        $someFile->addClass(new Class_(new Fqsen('\mySpace\MyClass')));
        $someFile->addNamespace(new Fqsen('\mySpace\SubSpace'));
        $someFile->addClass(new Class_(new Fqsen('\mySpace\SubSpace\MyClass')));

        $namespaces = $this->fetchNamespacesFromSingleFile($someFile);

        $this->assertCount(2, $namespaces);
        $this->assertArrayHasKey('\mySpace', $namespaces);
        $this->assertArrayHasKey('\mySpace\SubSpace', $namespaces);

        $this->assertCount(1, $namespaces['\mySpace']->getClasses());
    }

    /**
     * Uses the ProjectFactory to create a Project and returns the namespaces created by the factory.
     *
     * @return Namespace_[] Namespaces of the project
     *
     * @throws Exception
     */
    private function fetchNamespacesFromSingleFile(File $file): array
    {
        return $this->fetchNamespacesFromMultipleFiles([$file]);
    }

    /**
     * Uses the ProjectFactory to create a Project and returns the namespaces created by the factory.
     *
     * @param File[] $files
     *
     * @return Namespace_[] Namespaces of the project
     *
     * @throws Exception
     */
    private function fetchNamespacesFromMultipleFiles(array $files): array
    {
        $fileStrategyMock = $this->prophesize(ProjectFactoryStrategy::class);
        $fileStrategyMock->matches(
            ProphesizeArgument::type(ContextStack::class),
            ProphesizeArgument::any(),
        )->willReturn(true);

        $fileStrategyMock->create(
            ProphesizeArgument::type(ContextStack::class),
            ProphesizeArgument::type(File::class),
            ProphesizeArgument::any(),
        )->will(function ($args): void {
            $context = $args[0];
            assert($context instanceof ContextStack);

            $file = $args[1];
            assert($file instanceof File);
            $context->getProject()->addFile($file);
        });

        $projectFactory = new ProjectFactory([$fileStrategyMock->reveal()]);
        $project = $projectFactory->create('My Project', $files);

        return $project->getNamespaces();
    }
}
