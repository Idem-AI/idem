<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Security\CrowdSecApiClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class BouncerController extends Controller
{
    /**
     * ForwardAuth endpoint for Traefik
     * 
     * Traefik envoie une requête à cet endpoint avant de forward au backend.
     * Si on retourne 200, la requête passe.
     * Si on retourne 403, Traefik bloque.
     * 
     * GET /api/bouncer/check
     * Headers: X-Forwarded-For, X-Real-IP
     */
    public function check(Request $request)
    {
        // Extraire l'IP client
        $ip = $this->extractClientIP($request);
        
        // Check si l'IP est bannie (avec cache)
        $decision = $this->getDecision($ip);
        
        if ($decision === 'ban') {
            Log::info("Bouncer: Blocked IP {$ip}");
            
            return response()->view('errors.403-crowdsec', [
                'ip' => $ip,
                'reason' => 'Your IP has been blocked by our security system',
            ], 403);
        }
        
        // Allow
        return response('', 200);
    }
    
    /**
     * Health check endpoint
     */
    public function health()
    {
        return response()->json([
            'status' => 'ok',
            'service' => 'crowdsec-bouncer',
            'timestamp' => now()->toIso8601String(),
        ]);
    }
    
    /**
     * Extraire l'IP du client depuis les headers
     */
    private function extractClientIP(Request $request): string
    {
        // Priority: X-Forwarded-For > X-Real-IP > RemoteAddr
        $ip = $request->header('X-Forwarded-For');
        
        if ($ip) {
            // X-Forwarded-For peut contenir plusieurs IPs (chain)
            // On prend la première (client original)
            $ips = explode(',', $ip);
            return trim($ips[0]);
        }
        
        $ip = $request->header('X-Real-IP');
        if ($ip) {
            return $ip;
        }
        
        return $request->ip();
    }
    
    /**
     * Récupérer la décision pour une IP (avec cache)
     */
    private function getDecision(string $ip): string
    {
        $cacheKey = "bouncer_decision_{$ip}";
        
        // Cache de 30 secondes (balance entre performance et réactivité)
        return Cache::remember($cacheKey, 30, function() use ($ip) {
            return $this->checkCrowdSec($ip);
        });
    }
    
    /**
     * Vérifier l'IP dans CrowdSec LAPI
     */
    private function checkCrowdSec(string $ip): string
    {
        try {
            // Utiliser le service CrowdSecApiClient
            $client = app(CrowdSecApiClient::class);
            
            // Query CrowdSec pour cette IP
            $decisions = $client->getDecisions([
                'ip' => $ip
            ]);
            
            // Si des décisions existent, c'est un ban
            if (!empty($decisions)) {
                $decision = $decisions[0];
                $type = $decision['type'] ?? 'ban';
                
                Log::info("CrowdSec decision for {$ip}: {$type}");
                
                return $type;
            }
            
            // Pas de décision = allow
            return 'allow';
            
        } catch (\Exception $e) {
            Log::error("CrowdSec check failed for {$ip}: " . $e->getMessage());
            
            // Fail open (allow) en cas d'erreur
            // On préfère laisser passer que bloquer à tort
            return 'allow';
        }
    }
    
    /**
     * Flush le cache d'une IP (pour tests)
     */
    public function flushCache(Request $request)
    {
        $ip = $request->input('ip');
        
        if (!$ip) {
            return response()->json(['error' => 'IP required'], 400);
        }
        
        $cacheKey = "bouncer_decision_{$ip}";
        Cache::forget($cacheKey);
        
        return response()->json(['success' => true, 'message' => "Cache flushed for {$ip}"]);
    }
    
    /**
     * Stats du bouncer
     */
    public function stats()
    {
        // Compter les IPs en cache
        $cachedIPs = 0;
        $blockedIPs = 0;
        
        // Note: Pas de moyen simple de compter toutes les clés cache
        // Alternative : stocker stats séparément
        
        return response()->json([
            'cached_decisions' => $cachedIPs,
            'blocked_ips' => $blockedIPs,
            'cache_ttl' => 30,
            'status' => 'running',
        ]);
    }
}
