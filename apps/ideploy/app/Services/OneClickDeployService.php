<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Project;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use ZipArchive;

class OneClickDeployService
{
    public function deployFromZip($zipFile, $team, $projectName = null)
    {
        // 1. Extract ZIP
        $extractPath = $this->extractZip($zipFile);
        
        // 2. Detect framework
        $config = $this->detectFramework($extractPath);
        
        // 3. Create project if needed
        $project = $this->getOrCreateProject($team);
        
        // 4. Create application
        $app = $this->createApplication($project, $config, $projectName);
        
        // 5. Push code to Git repository (temporary)
        $this->pushCodeToRepository($app, $extractPath);
        
        // 6. Trigger deployment
        $app->deploy();
        
        return $app;
    }

    private function extractZip($zipFile): string
    {
        $tempDir = storage_path('app/one-click-deploy/' . Str::random(16));
        File::makeDirectory($tempDir, 0755, true);

        $zip = new ZipArchive;
        if ($zip->open($zipFile->getRealPath()) === TRUE) {
            $zip->extractTo($tempDir);
            $zip->close();
        }

        return $tempDir;
    }

    private function detectFramework(string $path): array
    {
        $config = [
            'buildPack' => 'nixpacks',
            'port' => 3000,
            'framework' => 'static'
        ];

        // Check for package.json
        if (File::exists("$path/package.json")) {
            $packageJson = json_decode(File::get("$path/package.json"), true);
            
            if (isset($packageJson['dependencies']['next'])) {
                $config['framework'] = 'nextjs';
                $config['port'] = 3000;
            } elseif (isset($packageJson['dependencies']['react'])) {
                $config['framework'] = 'react';
                $config['buildPack'] = 'static';
            } elseif (isset($packageJson['dependencies']['vue'])) {
                $config['framework'] = 'vue';
                $config['buildPack'] = 'static';
            }
        }

        // Check for index.html (static site)
        if (File::exists("$path/index.html")) {
            $config['buildPack'] = 'static';
            $config['framework'] = 'html';
        }

        return $config;
    }

    private function getOrCreateProject($team)
    {
        $project = $team->projects()->where('name', 'AppGen Deploys')->first();
        
        if (!$project) {
            $project = Project::create([
                'name' => 'AppGen Deploys',
                'team_id' => $team->id,
            ]);
        }

        return $project;
    }

    private function createApplication($project, $config, $projectName)
    {
        $destination = $project->destinations()->first() 
            ?? $project->team->servers()->first()->destinations()->first();

        return Application::create([
            'name' => $projectName ?? 'app-' . time(),
            'project_id' => $project->id,
            'destination_id' => $destination->id,
            'destination_type' => $destination->getMorphClass(),
            'build_pack' => $config['buildPack'],
            'ports_exposes' => $config['port'],
            'git_repository' => 'temporary-oneclick-deploy',
            'git_branch' => 'main',
        ]);
    }

    private function pushCodeToRepository($app, $sourcePath)
    {
        // For now, just copy code to application directory
        // TODO: Create temporary Git repository or use direct file deployment
    }
}
