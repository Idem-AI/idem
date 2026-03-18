<?php

require '/var/www/html/vendor/autoload.php';

$app = require_once '/var/www/html/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

echo "=== TEST GEMINI DIRECT ===" . PHP_EOL . PHP_EOL;

$apiKey = env('GEMINI_API_KEY');
$model = config('ai.providers.gemini.model');

echo "API Key: " . substr($apiKey, 0, 20) . "..." . PHP_EOL;
echo "Model: " . $model . PHP_EOL . PHP_EOL;

$prompt = "Analyze this Django project:\n\nrequirements.txt:\nDjango==4.2\npsycopg2-binary==2.9\n\nReturn ONLY JSON: {\"framework\": \"django\", \"port\": 8000}";

echo "Envoi requête à Gemini..." . PHP_EOL;

try {
    $response = Http::timeout(30)
        ->post(
            "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}",
            [
                'contents' => [
                    ['parts' => [['text' => $prompt]]]
                ],
                'generationConfig' => [
                    'temperature' => 0.1,
                    'maxOutputTokens' => 8192,
                ],
            ]
        )->json();

    echo "Réponse brute:" . PHP_EOL;
    echo json_encode($response, JSON_PRETTY_PRINT) . PHP_EOL . PHP_EOL;

    if (isset($response['error'])) {
        echo "❌ ERREUR: " . $response['error']['message'] . PHP_EOL;
        exit(1);
    }

    $text = $response['candidates'][0]['content']['parts'][0]['text'] ?? '{}';
    
    echo "Texte extrait:" . PHP_EOL;
    echo $text . PHP_EOL . PHP_EOL;

    // Extract JSON from markdown
    if (preg_match('/```json\s*(.*?)\s*```/s', $text, $matches)) {
        $text = $matches[1];
        echo "✅ JSON extrait du markdown" . PHP_EOL;
    }

    $result = json_decode($text, true);

    if ($result && isset($result['framework'])) {
        echo "✅ SUCCESS!" . PHP_EOL;
        echo "Framework: " . $result['framework'] . PHP_EOL;
        echo "Port: " . ($result['port'] ?? 'N/A') . PHP_EOL;
    } else {
        echo "❌ Échec du parsing JSON" . PHP_EOL;
    }

} catch (Exception $e) {
    echo "❌ EXCEPTION: " . $e->getMessage() . PHP_EOL;
}
