<?php

namespace App\Services\Security;

use App\Models\FirewallConfig;
use App\Models\FirewallRule;
use Illuminate\Support\Collection;

class BotManagementTemplateService
{
    /**
     * Get all available bot management templates
     */
    public function getTemplates(): array
    {
        return [
            'block_known_bots' => $this->getBlockKnownBotsTemplate(),
            'block_aggressive_crawlers' => $this->getBlockAggressiveCrawlersTemplate(),
            'challenge_suspicious_bots' => $this->getChallengeSuspiciousBotsTemplate(),
            'block_scrapers' => $this->getBlockScrapersTemplate(),
            'rate_limit_bots' => $this->getRateLimitBotsTemplate(),
        ];
    }

    /**
     * Get template by key
     */
    public function getTemplate(string $key): ?array
    {
        $templates = $this->getTemplates();
        return $templates[$key] ?? null;
    }

    /**
     * Import template and create rule
     */
    public function importTemplate(string $templateKey, FirewallConfig $config): FirewallRule
    {
        $template = $this->getTemplate($templateKey);
        
        if (!$template) {
            throw new \InvalidArgumentException("Template {$templateKey} not found");
        }

        // Create rule from template
        $rule = FirewallRule::create([
            'firewall_config_id' => $config->id,
            'name' => $template['name'],
            'description' => $template['description'],
            'rule_type' => $template['rule_type'] ?? 'inband',
            'protection_mode' => 'path_only', // AppSec inband mode
            'conditions' => $template['conditions'],
            'logical_operator' => $template['logical_operator'] ?? 'OR',
            'action' => $template['action'],
            'priority' => $template['priority'] ?? 100,
            'enabled' => true,
        ]);

        ray("✅ Template '{$templateKey}' imported as rule: {$rule->name}");

        return $rule;
    }

    /**
     * Template 1: Block Known Bots
     */
    private function getBlockKnownBotsTemplate(): array
    {
        return [
            'name' => 'Block Known Bots & Crawlers',
            'description' => 'Blocks common bots, crawlers, and scrapers based on User-Agent patterns',
            'category' => 'bot_blocking',
            'severity' => 'medium',
            'rule_type' => 'inband',
            'conditions' => [
                [
                    'field' => 'user_agent',
                    'operator' => 'regex',
                    'value' => '(bot|crawler|spider|scraper|slurp|archive|indexer|wget|curl)',
                    'transform' => [
                        'lowercase' => true,
                        'urldecode' => false,
                        'b64decode' => false,
                        'trim' => true,
                        'normalizepath' => false,
                    ]
                ]
            ],
            'logical_operator' => 'AND',
            'action' => 'block',
            'priority' => 90,
            'usage' => 'Blocks requests from common bots and crawlers. Use this to prevent scraping and indexing.',
            'examples' => [
                'Blocked User-Agents: Googlebot, AhrefsBot, SemrushBot, MJ12bot, curl, wget',
                'Allowed: Normal browsers (Chrome, Firefox, Safari)',
            ],
        ];
    }

    /**
     * Template 2: Block Aggressive Crawlers
     */
    private function getBlockAggressiveCrawlersTemplate(): array
    {
        return [
            'name' => 'Block Aggressive SEO Crawlers',
            'description' => 'Blocks aggressive SEO tools and audit bots that can overload your server',
            'category' => 'bot_blocking',
            'severity' => 'high',
            'rule_type' => 'inband',
            'conditions' => [
                [
                    'field' => 'user_agent',
                    'operator' => 'regex',
                    'value' => '(ahrefs|semrush|majestic|mj12|serpstat|cognitiveseo|linkdex|dotbot|rogerbot|exabot|ezooms)',
                    'transform' => [
                        'lowercase' => true,
                        'urldecode' => false,
                        'b64decode' => false,
                        'trim' => true,
                        'normalizepath' => false,
                    ]
                ]
            ],
            'logical_operator' => 'AND',
            'action' => 'block',
            'priority' => 85,
            'usage' => 'Specifically targets aggressive SEO crawlers that can impact performance.',
            'examples' => [
                'Blocked: AhrefsBot, SemrushBot, MJ12bot, DotBot, Exabot',
                'Good for: Protecting bandwidth and server resources',
            ],
        ];
    }

    /**
     * Template 3: Challenge Suspicious Bots
     */
    private function getChallengeSuspiciousBotsTemplate(): array
    {
        return [
            'name' => 'Challenge Suspicious Bots with CAPTCHA',
            'description' => 'Shows CAPTCHA to requests with missing or suspicious browser characteristics',
            'category' => 'bot_challenge',
            'severity' => 'low',
            'rule_type' => 'inband',
            'conditions' => [
                [
                    'field' => 'user_agent',
                    'operator' => 'regex',
                    'value' => '^(python|java|go-http|ruby|perl|libwww|httpclient)',
                    'transform' => [
                        'lowercase' => true,
                        'urldecode' => false,
                        'b64decode' => false,
                        'trim' => true,
                        'normalizepath' => false,
                    ]
                ]
            ],
            'logical_operator' => 'AND',
            'action' => 'captcha',
            'priority' => 95,
            'usage' => 'Less aggressive than blocking - allows legitimate automated tools to pass CAPTCHA.',
            'examples' => [
                'Challenged: Python scripts, Java clients, HTTP libraries',
                'Allows: Legitimate automation after CAPTCHA verification',
            ],
        ];
    }

    /**
     * Template 4: Block Scrapers
     */
    private function getBlockScrapersTemplate(): array
    {
        return [
            'name' => 'Block Content Scrapers',
            'description' => 'Blocks tools commonly used for content scraping and data extraction',
            'category' => 'scraper_blocking',
            'severity' => 'high',
            'rule_type' => 'inband',
            'conditions' => [
                [
                    'field' => 'user_agent',
                    'operator' => 'regex',
                    'value' => '(scrapy|beautifulsoup|selenium|phantomjs|headless|puppeteer|playwright|apify|scrapingbot|import\\.io|parsehub)',
                    'transform' => [
                        'lowercase' => true,
                        'urldecode' => false,
                        'b64decode' => false,
                        'trim' => true,
                        'normalizepath' => false,
                    ]
                ]
            ],
            'logical_operator' => 'AND',
            'action' => 'block',
            'priority' => 80,
            'usage' => 'Prevents automated scraping of your content and data.',
            'examples' => [
                'Blocked: Scrapy, BeautifulSoup, Selenium, Puppeteer, Playwright',
                'Protects: Product data, pricing, content theft',
            ],
        ];
    }

    /**
     * Template 5: Rate Limit Bots (Out-of-band)
     */
    private function getRateLimitBotsTemplate(): array
    {
        return [
            'name' => 'Monitor High-Frequency Bot Activity',
            'description' => 'Logs suspicious bot behavior for rate limiting analysis (non-blocking)',
            'category' => 'bot_monitoring',
            'severity' => 'low',
            'rule_type' => 'outofband',
            'conditions' => [
                [
                    'field' => 'user_agent',
                    'operator' => 'contains',
                    'value' => 'bot',
                    'transform' => [
                        'lowercase' => true,
                        'urldecode' => false,
                        'b64decode' => false,
                        'trim' => true,
                        'normalizepath' => false,
                    ]
                ]
            ],
            'logical_operator' => 'AND',
            'action' => 'log',
            'priority' => 100,
            'usage' => 'Non-blocking monitoring to analyze bot patterns before implementing stricter rules.',
            'examples' => [
                'Monitors: All User-Agents containing "bot"',
                'Action: Logs only (no blocking)',
                'Use: Understand bot traffic before blocking',
            ],
        ];
    }

    /**
     * Get template statistics
     */
    public function getTemplateStats(): array
    {
        $templates = $this->getTemplates();
        
        return [
            'total' => count($templates),
            'by_category' => $this->groupByCategory($templates),
            'by_severity' => $this->groupBySeverity($templates),
            'by_action' => $this->groupByAction($templates),
        ];
    }

    /**
     * Group templates by category
     */
    private function groupByCategory(array $templates): array
    {
        $groups = [];
        
        foreach ($templates as $key => $template) {
            $category = $template['category'];
            if (!isset($groups[$category])) {
                $groups[$category] = [];
            }
            $groups[$category][] = $key;
        }
        
        return $groups;
    }

    /**
     * Group templates by severity
     */
    private function groupBySeverity(array $templates): array
    {
        $groups = ['low' => 0, 'medium' => 0, 'high' => 0, 'critical' => 0];
        
        foreach ($templates as $template) {
            $severity = $template['severity'] ?? 'medium';
            $groups[$severity]++;
        }
        
        return $groups;
    }

    /**
     * Group templates by action
     */
    private function groupByAction(array $templates): array
    {
        $groups = ['block' => 0, 'captcha' => 0, 'log' => 0];
        
        foreach ($templates as $template) {
            $action = $template['action'];
            $groups[$action]++;
        }
        
        return $groups;
    }

    /**
     * Search templates
     */
    public function searchTemplates(string $query): array
    {
        $templates = $this->getTemplates();
        $query = strtolower($query);
        
        return array_filter($templates, function($template) use ($query) {
            return str_contains(strtolower($template['name']), $query) ||
                   str_contains(strtolower($template['description']), $query) ||
                   str_contains(strtolower($template['category']), $query);
        });
    }
}
