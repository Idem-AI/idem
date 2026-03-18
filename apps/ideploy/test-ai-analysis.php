#!/usr/bin/env php
<?php

require __DIR__ . '/apps/ideploy/vendor/autoload.php';
$app = require_once __DIR__ . '/apps/ideploy/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\Http;

echo "=== TEST AI ANALYSIS DEBUG ===" . PHP_EOL . PHP_EOL;

// 1. Demander l'URL du repo
if ($argc < 2) {
    echo "Usage: php test-ai-analysis.php <github-url> [branch]" . PHP_EOL;
    echo "Example: php test-ai-analysis.php https://github.com/laravel/laravel main" . PHP_EOL;
    exit(1);
}

$repositoryUrl = $argv[1];
$branch = $argv[2] ?? 'main';

echo "Repository: {$repositoryUrl}" . PHP_EOL;
echo "Branch: {$branch}" . PHP_EOL . PHP_EOL;

// 2. Vérifier rate limit
echo "--- STEP 1: Checking GitHub Rate Limit ---" . PHP_EOL;
$rateLimit = Http::get('https://api.github.com/rate_limit')->json();
$remaining = $rateLimit['resources']['core']['remaining'];
$limit = $rateLimit['resources']['core']['limit'];
$reset = date('H:i:s', $rateLimit['resources']['core']['reset']);

echo "Rate Limit: {$remaining}/{$limit} remaining (reset at {$reset})" . PHP_EOL;

if ($remaining < 11) {
    echo "❌ PROBLÈME: Rate limit trop bas (besoin de 11 requêtes minimum)" . PHP_EOL;
    echo "   Attendre jusqu'à {$reset} ou ajouter GITHUB_TOKEN dans .env" . PHP_EOL;
    exit(1);
}
echo "✅ Rate limit OK" . PHP_EOL . PHP_EOL;

// 3. Tester le regex
echo "--- STEP 2: Testing URL Parsing ---" . PHP_EOL;
preg_match('#github\.com/([^/]+)/([^/]+?)(?:\.git|/tree|/blob|/|$)#', $repositoryUrl, $matches);

if (count($matches) < 3) {
    echo "❌ PROBLÈME: URL ne match pas le regex" . PHP_EOL;
    echo "   URL fournie: {$repositoryUrl}" . PHP_EOL;
    exit(1);
}

$owner = $matches[1];
$repo = $matches[2];

echo "Owner: {$owner}" . PHP_EOL;
echo "Repo: {$repo}" . PHP_EOL;

// Extract subPath
$subPath = '';
if (preg_match('#/tree/[^/]+/(.+)$#', $repositoryUrl, $pathMatches)) {
    $subPath = $pathMatches[1] . '/';
    echo "SubPath: {$subPath}" . PHP_EOL;
}
echo "✅ URL parsed successfully" . PHP_EOL . PHP_EOL;

// 4. Tester la récupération des fichiers
echo "--- STEP 3: Fetching Repository Files ---" . PHP_EOL;

$githubToken = env('GITHUB_TOKEN');
if ($githubToken) {
    echo "Using GitHub token: " . substr($githubToken, 0, 10) . "..." . PHP_EOL;
}

$criticalFiles = [
    'package.json', 'composer.json', 'requirements.txt', 'Gemfile',
    'go.mod', 'Cargo.toml', 'Dockerfile', 'docker-compose.yml',
    '.env.example', 'nixpacks.toml', 'README.md'
];

$files = [];
$filesFound = [];

foreach ($criticalFiles as $file) {
    $filePath = $subPath . $file;
    
    try {
        $request = Http::timeout(10);
        if ($githubToken) {
            $request = $request->withToken($githubToken);
        }
        
        $response = $request->get("https://api.github.com/repos/{$owner}/{$repo}/contents/{$filePath}", [
            'ref' => $branch,
        ])->json();
        
        if (isset($response['content'])) {
            $content = base64_decode($response['content']);
            $files[$file] = $content;
            $filesFound[] = $file;
            echo "  ✅ {$file} (" . strlen($content) . " bytes)" . PHP_EOL;
        }
    } catch (\Exception $e) {
        // File not found
    }
}

echo PHP_EOL . "Files found: " . count($files) . "/" . count($criticalFiles) . PHP_EOL;

if (count($files) === 0) {
    echo "❌ PROBLÈME: Aucun fichier récupéré!" . PHP_EOL;
    echo "   Vérifier que le repo existe et que la branche est correcte" . PHP_EOL;
    exit(1);
}
echo "✅ Files retrieved: " . implode(', ', $filesFound) . PHP_EOL . PHP_EOL;

// 5. Construire le prompt
echo "--- STEP 4: Building AI Prompt ---" . PHP_EOL;

$prompt = "Tu es un expert DevOps senior avec 15 ans d'expérience. Analyse ce repository et détermine la configuration de déploiement OPTIMALE.\n\n";
$prompt .= "FICHIERS DU REPOSITORY:\n\n";

if (isset($files['package.json'])) {
    $prompt .= "package.json:\n```json\n" . $files['package.json'] . "\n```\n\n";
}

if (isset($files['composer.json'])) {
    $prompt .= "composer.json:\n```json\n" . $files['composer.json'] . "\n```\n\n";
}

if (isset($files['requirements.txt'])) {
    $prompt .= "requirements.txt:\n```\n" . $files['requirements.txt'] . "\n```\n\n";
}

if (isset($files['Dockerfile'])) {
    $prompt .= "Dockerfile existant:\n```dockerfile\n" . $files['Dockerfile'] . "\n```\n\n";
}

$prompt .= "ANALYSE REQUISE:\n";
$prompt .= "1. Détecte le framework et sa version\n";
$prompt .= "2. Choisis le meilleur build pack (nixpacks > dockerfile > static)\n";
$prompt .= "3. Identifie les variables d'environnement nécessaires\n";
$prompt .= "4. Détecte les bases de données requises\n";
$prompt .= "5. Détermine le port exposé\n\n";
$prompt .= "RETOURNE UNIQUEMENT un JSON valide avec cette structure EXACTE (pas de markdown, pas de ```json):\n";
$prompt .= '{"framework": "nextjs|laravel|django|react|vue|nuxt|express|fastapi|rails|go|rust|unknown", "frameworkVersion": "14.0.0", "buildPack": "nixpacks|dockerfile|static", "port": 3000}';

echo "Prompt length: " . strlen($prompt) . " characters" . PHP_EOL;
echo "Prompt preview (first 500 chars):" . PHP_EOL;
echo str_repeat('-', 80) . PHP_EOL;
echo substr($prompt, 0, 500) . "..." . PHP_EOL;
echo str_repeat('-', 80) . PHP_EOL . PHP_EOL;

// 6. Tester avec Gemini
echo "--- STEP 5: Testing Gemini AI Analysis ---" . PHP_EOL;

$geminiKey = env('GEMINI_API_KEY');
if (!$geminiKey) {
    echo "❌ GEMINI_API_KEY not configured in .env" . PHP_EOL;
    exit(1);
}

echo "Calling Gemini API..." . PHP_EOL;

try {
    $response = Http::timeout(30)
        ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={$geminiKey}", [
            'contents' => [
                ['parts' => [['text' => $prompt]]]
            ],
            'generationConfig' => [
                'temperature' => 0.1,
                'topK' => 40,
                'topP' => 0.95,
                'maxOutputTokens' => 8192,
                'responseMimeType' => 'application/json',
            ],
        ])->json();
    
    $text = $response['candidates'][0]['content']['parts'][0]['text'] ?? '{}';
    
    echo "✅ Gemini response received (" . strlen($text) . " chars)" . PHP_EOL;
    echo "Response:" . PHP_EOL;
    echo str_repeat('-', 80) . PHP_EOL;
    echo $text . PHP_EOL;
    echo str_repeat('-', 80) . PHP_EOL . PHP_EOL;
    
    $result = json_decode($text, true);
    
    if (!$result) {
        echo "❌ PROBLÈME: Gemini n'a pas retourné du JSON valide" . PHP_EOL;
        exit(1);
    }
    
    echo "--- FINAL RESULT ---" . PHP_EOL;
    echo "Framework: " . ($result['framework'] ?? 'unknown') . PHP_EOL;
    echo "Version: " . ($result['frameworkVersion'] ?? 'N/A') . PHP_EOL;
    echo "Build Pack: " . ($result['buildPack'] ?? 'N/A') . PHP_EOL;
    echo "Port: " . ($result['port'] ?? 'N/A') . PHP_EOL;
    
    if (($result['framework'] ?? 'unknown') === 'unknown') {
        echo PHP_EOL . "⚠️  WARNING: Framework not detected!" . PHP_EOL;
        echo "   This might be because:" . PHP_EOL;
        echo "   1. No package.json/composer.json/requirements.txt found" . PHP_EOL;
        echo "   2. Gemini couldn't identify the framework from the files" . PHP_EOL;
        echo "   3. The prompt needs to be improved" . PHP_EOL;
    } else {
        echo PHP_EOL . "✅ SUCCESS: Framework detected correctly!" . PHP_EOL;
    }
    
} catch (\Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . PHP_EOL;
    exit(1);
}
