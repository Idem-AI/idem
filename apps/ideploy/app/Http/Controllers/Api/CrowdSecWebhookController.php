<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\FirewallConfig;
use App\Models\FirewallTrafficLog;
use App\Models\FirewallRule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class CrowdSecWebhookController extends Controller
{
    /**
     * Handle CrowdSec traffic webhook
     * 
     * POST /api/crowdsec/traffic-log
     */
    public function trafficLog(Request $request)
    {
        try {
            // Valider le token webhook
            if (!$this->validateWebhookToken($request)) {
                Log::warning('CrowdSec webhook: Invalid token', [
                    'ip' => $request->ip(),
                    'token' => $request->header('X-CrowdSec-Token'),
                ]);
                return response()->json(['error' => 'Unauthorized'], 401);
            }
            
            // Valider les données
            $validator = Validator::make($request->all(), [
                'application_uuid' => 'required|string',
                'ip_address' => 'required|ip',
                'method' => 'required|string',
                'uri' => 'required|string',
                'user_agent' => 'nullable|string',
                'decision' => 'required|string|in:allow,ban,captcha',
                'rule_name' => 'nullable|string',
                'country' => 'nullable|string',
                'asn' => 'nullable|string',
            ]);
            
            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation failed',
                    'messages' => $validator->errors()
                ], 422);
            }
            
            $data = $validator->validated();
            
            // Trouver l'application
            $app = Application::where('uuid', $data['application_uuid'])->first();
            
            if (!$app) {
                Log::warning('CrowdSec webhook: Application not found', [
                    'uuid' => $data['application_uuid']
                ]);
                return response()->json(['error' => 'Application not found'], 404);
            }
            
            // Vérifier que le firewall est activé
            $config = $app->firewallConfig;
            
            if (!$config || !$config->enabled) {
                Log::info('CrowdSec webhook: Firewall not enabled for app', [
                    'app_id' => $app->id,
                    'app_name' => $app->name,
                ]);
                return response()->json(['error' => 'Firewall not enabled'], 403);
            }
            
            // Créer le log de trafic
            $log = FirewallTrafficLog::create([
                'firewall_config_id' => $config->id,
                'application_id' => $app->id,
                'ip_address' => $data['ip_address'],
                'method' => $data['method'],
                'uri' => $data['uri'],
                'user_agent' => $data['user_agent'] ?? null,
                'decision' => $data['decision'],
                'rule_name' => $data['rule_name'] ?? null,
                'country' => $data['country'] ?? null,
                'asn' => $data['asn'] ?? null,
                'timestamp' => now(),
            ]);
            
            // Mettre à jour les compteurs
            $this->updateStats($config, $data['decision']);
            
            // Incrémenter le match_count de la règle si bloqué
            if ($data['decision'] === 'ban' && $data['rule_name']) {
                $this->incrementRuleMatches($config, $data['rule_name']);
            }
            
            Log::info('CrowdSec traffic logged', [
                'app_id' => $app->id,
                'ip' => $data['ip_address'],
                'uri' => $data['uri'],
                'decision' => $data['decision'],
            ]);
            
            return response()->json([
                'success' => true,
                'log_id' => $log->id,
            ], 201);
            
        } catch (\Exception $e) {
            Log::error('CrowdSec webhook error: ' . $e->getMessage(), [
                'exception' => get_class($e),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return response()->json([
                'error' => 'Internal server error',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred'
            ], 500);
        }
    }
    
    /**
     * Valider le token webhook
     */
    private function validateWebhookToken(Request $request): bool
    {
        $token = $request->header('X-CrowdSec-Token');
        
        if (!$token) {
            return false;
        }
        
        // Token global configuré dans .env
        $expectedToken = config('crowdsec.webhook_token');
        
        if (!$expectedToken) {
            Log::warning('CrowdSec webhook token not configured in .env');
            return false;
        }
        
        return hash_equals($expectedToken, $token);
    }
    
    /**
     * Mettre à jour les statistiques
     */
    private function updateStats(FirewallConfig $config, string $decision): void
    {
        $config->increment('total_requests');
        
        if ($decision === 'ban') {
            $config->increment('total_blocked');
        } else {
            $config->increment('total_allowed');
        }
    }
    
    /**
     * Incrémenter le compteur de matches d'une règle
     */
    private function incrementRuleMatches(FirewallConfig $config, string $ruleName): void
    {
        $rule = $config->rules()
            ->where('name', $ruleName)
            ->orWhere('name', 'like', '%' . $ruleName . '%')
            ->first();
        
        if ($rule) {
            $rule->incrementMatchCount();
        }
    }
    
    /**
     * Health check endpoint
     * 
     * GET /api/crowdsec/health
     */
    public function health()
    {
        return response()->json([
            'status' => 'ok',
            'service' => 'crowdsec-webhook',
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}
