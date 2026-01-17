<?php

namespace App\Services\Security;

use App\Models\FirewallConfig;
use App\Models\FirewallRule;

class RateLimitTemplateService
{
    protected array $templates = [];
    
    public function __construct()
    {
        $this->loadTemplates();
    }
    
    /**
     * Load all protection pattern templates
     * Note: These are static filtering rules, not true rate limiting with temporal tracking.
     * For real rate limiting, use CrowdSec Scenarios (planned for future release).
     */
    protected function loadTemplates(): void
    {
        $this->templates = [
            'api_rate_limit' => [
                'name' => 'API Protection Pattern',
                'description' => 'Filter and monitor API requests (Note: Pattern-based filtering, not temporal rate limiting)',
                'category' => 'rate_limiting',
                'severity' => 'medium',
                'action' => 'block',
                'usage' => 'Protect your API endpoints from excessive requests. Automatically blocks IPs making more than 100 requests per minute to /api/* endpoints.',
                'conditions' => [
                    [
                        'field' => 'request_path',
                        'operator' => 'starts_with',
                        'value' => '/api/',
                    ]
                ],
                'rate_limit' => [
                    'window' => 60,
                    'threshold' => 100,
                    'tracking' => 'ip'
                ],
                'duration' => 300,
                'examples' => ['/api/users', '/api/posts', '/api/products', '/api/v1/data']
            ],
            
            'login_brute_force' => [
                'name' => 'Login Protection Pattern',
                'description' => 'Monitor and filter login requests (Note: Pattern-based, not attempt counting)',
                'category' => 'authentication',
                'severity' => 'high',
                'action' => 'block',
                'usage' => 'Protect login pages from credential stuffing and brute force attacks. Blocks IPs after 5 POST requests to /login within 5 minutes.',
                'conditions' => [
                    [
                        'field' => 'request_path',
                        'operator' => 'contains',
                        'value' => 'login',
                    ],
                    [
                        'field' => 'method',
                        'operator' => 'equals',
                        'value' => 'POST',
                    ]
                ],
                'logical_operator' => 'AND',
                'rate_limit' => [
                    'window' => 300,
                    'threshold' => 5,
                    'tracking' => 'ip'
                ],
                'duration' => 1800,
                'examples' => ['POST /login', 'POST /auth/login', 'POST /signin', 'POST /admin/login']
            ],
            
            'scraping_protection' => [
                'name' => 'Anti-Scraping Pattern',
                'description' => 'Filter non-browser User-Agents (Note: Pattern-based detection)',
                'category' => 'anti_scraping',
                'severity' => 'low',
                'action' => 'captcha',
                'usage' => 'Detect and slow down automated scrapers. Shows CAPTCHA to requests without browser User-Agent making more than 30 requests per minute.',
                'conditions' => [
                    [
                        'field' => 'user_agent',
                        'operator' => 'not_contains',
                        'value' => 'Mozilla',
                    ]
                ],
                'rate_limit' => [
                    'window' => 60,
                    'threshold' => 30,
                    'tracking' => 'ip'
                ],
                'duration' => 600,
                'examples' => ['curl/7.68.0', 'python-requests/2.25.1', 'Go-http-client/1.1', 'wget/1.20.3']
            ],
            
            'form_submission_limit' => [
                'name' => 'Form Submission Pattern',
                'description' => 'Monitor form submission requests (Note: Pattern-based filtering)',
                'category' => 'anti_spam',
                'severity' => 'medium',
                'action' => 'block',
                'usage' => 'Prevent form spam and abuse. Blocks IPs submitting more than 10 forms per hour to contact/feedback/subscribe endpoints.',
                'conditions' => [
                    [
                        'field' => 'request_path',
                        'operator' => 'regex',
                        'value' => '/(contact|feedback|subscribe)',
                    ],
                    [
                        'field' => 'method',
                        'operator' => 'equals',
                        'value' => 'POST',
                    ]
                ],
                'logical_operator' => 'AND',
                'rate_limit' => [
                    'window' => 3600,
                    'threshold' => 10,
                    'tracking' => 'ip'
                ],
                'duration' => 7200,
                'examples' => ['POST /contact', 'POST /feedback', 'POST /subscribe', 'POST /newsletter']
            ],
            
            'download_rate_limit' => [
                'name' => 'Download Protection Pattern',
                'description' => 'Monitor file download requests (Note: Pattern-based filtering)',
                'category' => 'bandwidth_control',
                'severity' => 'low',
                'action' => 'block',
                'usage' => 'Control bandwidth usage from excessive downloads. Blocks IPs downloading more than 50 files (PDF, ZIP, videos) per day.',
                'conditions' => [
                    [
                        'field' => 'request_path',
                        'operator' => 'regex',
                        'value' => '\\.(pdf|zip|tar|gz|mp4|avi|mkv)$',
                    ]
                ],
                'rate_limit' => [
                    'window' => 86400,
                    'threshold' => 50,
                    'tracking' => 'ip'
                ],
                'duration' => 86400,
                'examples' => ['/downloads/file.pdf', '/media/video.mp4', '/archives/backup.zip', '/docs/manual.pdf']
            ],
        ];
    }
    
    /**
     * Get all templates
     */
    public function getTemplates(): array
    {
        return $this->templates;
    }
    
    /**
     * Get template by key
     */
    public function getTemplate(string $key): ?array
    {
        return $this->templates[$key] ?? null;
    }
    
    /**
     * Import template and create rule
     */
    public function importTemplate(string $templateKey, FirewallConfig $config): FirewallRule
    {
        $template = $this->getTemplate($templateKey);
        
        if (!$template) {
            throw new \Exception("Template '{$templateKey}' not found");
        }
        
        // Create firewall rule from template
        $rule = FirewallRule::create([
            'firewall_config_id' => $config->id,
            'name' => $template['name'],
            'description' => $template['description'],
            'protection_mode' => 'path_only', // AppSec inband mode
            'conditions' => $template['conditions'],
            'logical_operator' => $template['logical_operator'] ?? 'AND',
            'action' => $template['action'],
            'priority' => 50, // Medium priority
            'enabled' => true,
        ]);
        
        ray("✅ Protection pattern template imported: {$template['name']}");
        
        return $rule;
    }
    
    /**
     * Get template statistics
     */
    public function getTemplateStats(): array
    {
        $stats = [
            'total' => count($this->templates),
            'by_category' => [],
            'by_severity' => [],
            'by_action' => [],
        ];
        
        foreach ($this->templates as $template) {
            // By category
            $category = $template['category'];
            $stats['by_category'][$category] = ($stats['by_category'][$category] ?? 0) + 1;
            
            // By severity
            $severity = $template['severity'];
            $stats['by_severity'][$severity] = ($stats['by_severity'][$severity] ?? 0) + 1;
            
            // By action
            $action = $template['action'];
            $stats['by_action'][$action] = ($stats['by_action'][$action] ?? 0) + 1;
        }
        
        return $stats;
    }
    
    /**
     * Search templates
     */
    public function searchTemplates(string $query): array
    {
        $query = strtolower($query);
        $results = [];
        
        foreach ($this->templates as $key => $template) {
            if (
                str_contains(strtolower($template['name']), $query) ||
                str_contains(strtolower($template['description']), $query) ||
                str_contains(strtolower($template['category']), $query)
            ) {
                $results[$key] = $template;
            }
        }
        
        return $results;
    }
}
