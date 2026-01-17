<?php

namespace App\Jobs\Pipeline\Stages;

use App\Models\Application;
use App\Models\PipelineExecution;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\File;

class TestStageJob
{
    protected PipelineExecution $execution;
    protected Application $application;
    protected array $stage;

    public function __construct(PipelineExecution $execution, Application $application, array $stage)
    {
        $this->execution = $execution;
        $this->application = $application;
        $this->stage = $stage;
    }

    public function handle(): array
    {
        try {
            $sourcePath = $this->getSourcePath();
            
            // Auto-detect test framework if configured
            if ($this->stage['config']['auto_detect'] ?? true) {
                $framework = $this->detectTestFramework($sourcePath);
                if (!$framework) {
                    $this->log("No test framework detected, skipping tests");
                    return ['success' => true, 'message' => 'No tests to run'];
                }
                $this->log("Detected test framework: {$framework}");
            } else {
                $framework = strtolower($this->stage['tool']);
            }

            // Run tests based on framework
            return match($framework) {
                'jest' => $this->runJest($sourcePath),
                'pytest' => $this->runPytest($sourcePath),
                'phpunit' => $this->runPhpUnit($sourcePath),
                'go test' => $this->runGoTest($sourcePath),
                'cargo' => $this->runCargo($sourcePath),
                default => ['success' => true, 'message' => 'Unknown framework, skipped'],
            };
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => 'Exception: ' . $e->getMessage(),
            ];
        }
    }

    protected function detectTestFramework(string $path): ?string
    {
        // Check for Node.js (Jest)
        if (File::exists("{$path}/package.json")) {
            $package = json_decode(File::get("{$path}/package.json"), true);
            if (isset($package['devDependencies']['jest']) || isset($package['dependencies']['jest'])) {
                return 'jest';
            }
        }

        // Check for Python (Pytest)
        if (File::exists("{$path}/requirements.txt") || File::exists("{$path}/setup.py") || File::exists("{$path}/pyproject.toml")) {
            if (File::exists("{$path}/pytest.ini") || File::exists("{$path}/setup.cfg")) {
                return 'pytest';
            }
        }

        // Check for PHP (PHPUnit)
        if (File::exists("{$path}/composer.json")) {
            $composer = json_decode(File::get("{$path}/composer.json"), true);
            if (isset($composer['require-dev']['phpunit/phpunit'])) {
                return 'phpunit';
            }
        }

        // Check for Go
        if (File::exists("{$path}/go.mod")) {
            return 'go test';
        }

        // Check for Rust
        if (File::exists("{$path}/Cargo.toml")) {
            return 'cargo';
        }

        return null;
    }

    protected function runJest(string $path): array
    {
        $this->log("Running Jest tests...");
        
        $command = "cd {$path} && npm test -- --coverage --passWithNoTests";
        $result = Process::timeout(600)->run($command);

        $this->log($result->output());

        if (!$result->successful()) {
            return [
                'success' => false,
                'error' => 'Jest tests failed',
            ];
        }

        return ['success' => true];
    }

    protected function runPytest(string $path): array
    {
        $this->log("Running Pytest...");
        
        $command = "cd {$path} && pytest -v --tb=short";
        $result = Process::timeout(600)->run($command);

        $this->log($result->output());

        if (!$result->successful()) {
            return [
                'success' => false,
                'error' => 'Pytest tests failed',
            ];
        }

        return ['success' => true];
    }

    protected function runPhpUnit(string $path): array
    {
        $this->log("Running PHPUnit...");
        
        $command = "cd {$path} && ./vendor/bin/phpunit";
        $result = Process::timeout(600)->run($command);

        $this->log($result->output());

        if (!$result->successful()) {
            return [
                'success' => false,
                'error' => 'PHPUnit tests failed',
            ];
        }

        return ['success' => true];
    }

    protected function runGoTest(string $path): array
    {
        $this->log("Running Go tests...");
        
        $command = "cd {$path} && go test ./... -v";
        $result = Process::timeout(600)->run($command);

        $this->log($result->output());

        if (!$result->successful()) {
            return [
                'success' => false,
                'error' => 'Go tests failed',
            ];
        }

        return ['success' => true];
    }

    protected function runCargo(string $path): array
    {
        $this->log("Running Cargo tests...");
        
        $command = "cd {$path} && cargo test";
        $result = Process::timeout(600)->run($command);

        $this->log($result->output());

        if (!$result->successful()) {
            return [
                'success' => false,
                'error' => 'Cargo tests failed',
            ];
        }

        return ['success' => true];
    }

    protected function getSourcePath(): string
    {
        return "/tmp/pipeline-{$this->application->uuid}/source";
    }

    protected function log(string $message): void
    {
        \App\Models\PipelineLog::create([
            'pipeline_execution_id' => $this->execution->id,
            'stage_id' => $this->stage['id'],
            'stage_name' => $this->stage['name'],
            'level' => 'info',
            'message' => $message,
            'logged_at' => now(),
        ]);
    }
}
