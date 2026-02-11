<?php

namespace App\Services\Pipeline;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class LanguageDetectorService
{
    /**
     * Detect the primary language of a project
     */
    public function detect(string $projectPath): array
    {
        Log::info("Detecting language for project: {$projectPath}");

        $detectedLanguages = [];

        // Check for PHP
        if ($this->hasFiles($projectPath, ['composer.json', '*.php'])) {
            $detectedLanguages[] = [
                'language' => 'PHP',
                'confidence' => $this->calculateConfidence($projectPath, '*.php'),
                'framework' => $this->detectPHPFramework($projectPath),
            ];
        }

        // Check for Node.js/JavaScript
        if ($this->hasFiles($projectPath, ['package.json', '*.js', '*.ts'])) {
            $detectedLanguages[] = [
                'language' => 'JavaScript/TypeScript',
                'confidence' => $this->calculateConfidence($projectPath, ['*.js', '*.ts']),
                'framework' => $this->detectJSFramework($projectPath),
            ];
        }

        // Check for Python
        if ($this->hasFiles($projectPath, ['requirements.txt', 'setup.py', '*.py'])) {
            $detectedLanguages[] = [
                'language' => 'Python',
                'confidence' => $this->calculateConfidence($projectPath, '*.py'),
                'framework' => $this->detectPythonFramework($projectPath),
            ];
        }

        // Check for Java
        if ($this->hasFiles($projectPath, ['pom.xml', 'build.gradle', '*.java'])) {
            $detectedLanguages[] = [
                'language' => 'Java',
                'confidence' => $this->calculateConfidence($projectPath, '*.java'),
                'framework' => $this->detectJavaFramework($projectPath),
            ];
        }

        // Check for Go
        if ($this->hasFiles($projectPath, ['go.mod', '*.go'])) {
            $detectedLanguages[] = [
                'language' => 'Go',
                'confidence' => $this->calculateConfidence($projectPath, '*.go'),
                'framework' => null,
            ];
        }

        // Check for Ruby
        if ($this->hasFiles($projectPath, ['Gemfile', '*.rb'])) {
            $detectedLanguages[] = [
                'language' => 'Ruby',
                'confidence' => $this->calculateConfidence($projectPath, '*.rb'),
                'framework' => $this->detectRubyFramework($projectPath),
            ];
        }

        // Sort by confidence
        usort($detectedLanguages, fn($a, $b) => $b['confidence'] <=> $a['confidence']);

        return [
            'primary' => $detectedLanguages[0] ?? ['language' => 'Unknown', 'confidence' => 0, 'framework' => null],
            'all' => $detectedLanguages,
        ];
    }

    private function hasFiles(string $path, array $patterns): bool
    {
        foreach ($patterns as $pattern) {
            if (File::exists("{$path}/{$pattern}") || !empty(File::glob("{$path}/{$pattern}"))) {
                return true;
            }
        }
        return false;
    }

    private function calculateConfidence(string $path, $patterns): int
    {
        $patterns = is_array($patterns) ? $patterns : [$patterns];
        $fileCount = 0;

        foreach ($patterns as $pattern) {
            $fileCount += count(File::glob("{$path}/{$pattern}"));
        }

        // Simple confidence based on file count
        return min(100, $fileCount * 10);
    }

    private function detectPHPFramework(string $path): ?string
    {
        $composerFile = "{$path}/composer.json";
        if (File::exists($composerFile)) {
            $composer = json_decode(File::get($composerFile), true);
            $require = $composer['require'] ?? [];

            if (isset($require['laravel/framework'])) return 'Laravel';
            if (isset($require['symfony/symfony'])) return 'Symfony';
            if (isset($require['cakephp/cakephp'])) return 'CakePHP';
            if (isset($require['codeigniter4/framework'])) return 'CodeIgniter';
        }

        return null;
    }

    private function detectJSFramework(string $path): ?string
    {
        $packageFile = "{$path}/package.json";
        if (File::exists($packageFile)) {
            $package = json_decode(File::get($packageFile), true);
            $dependencies = array_merge(
                $package['dependencies'] ?? [],
                $package['devDependencies'] ?? []
            );

            if (isset($dependencies['react'])) return 'React';
            if (isset($dependencies['vue'])) return 'Vue.js';
            if (isset($dependencies['@angular/core'])) return 'Angular';
            if (isset($dependencies['next'])) return 'Next.js';
            if (isset($dependencies['nuxt'])) return 'Nuxt.js';
            if (isset($dependencies['express'])) return 'Express';
            if (isset($dependencies['nestjs'])) return 'NestJS';
        }

        return null;
    }

    private function detectPythonFramework(string $path): ?string
    {
        $requirementsFile = "{$path}/requirements.txt";
        if (File::exists($requirementsFile)) {
            $requirements = File::get($requirementsFile);

            if (str_contains($requirements, 'Django')) return 'Django';
            if (str_contains($requirements, 'Flask')) return 'Flask';
            if (str_contains($requirements, 'FastAPI')) return 'FastAPI';
        }

        return null;
    }

    private function detectJavaFramework(string $path): ?string
    {
        $pomFile = "{$path}/pom.xml";
        if (File::exists($pomFile)) {
            $pom = File::get($pomFile);

            if (str_contains($pom, 'spring-boot')) return 'Spring Boot';
            if (str_contains($pom, 'quarkus')) return 'Quarkus';
        }

        return null;
    }

    private function detectRubyFramework(string $path): ?string
    {
        $gemfile = "{$path}/Gemfile";
        if (File::exists($gemfile)) {
            $content = File::get($gemfile);

            if (str_contains($content, 'rails')) return 'Ruby on Rails';
            if (str_contains($content, 'sinatra')) return 'Sinatra';
        }

        return null;
    }
}
