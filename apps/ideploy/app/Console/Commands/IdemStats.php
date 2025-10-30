<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\Team;
use App\Models\Server;
use App\Models\Application;
use App\Models\IdemSubscriptionPlan;
use App\Services\IdemServerService;

class IdemStats extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'idem:stats {--detailed : Show detailed statistics}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Display IDEM SaaS platform statistics';

    /**
     * Execute the console command.
     */
    public function handle(IdemServerService $serverService): int
    {
        $this->info('📊 IDEM SaaS Platform Statistics');
        $this->newLine();

        // Users Statistics
        $this->displayUsersStats();
        $this->newLine();

        // Teams Statistics
        $this->displayTeamsStats();
        $this->newLine();

        // Servers Statistics
        $this->displayServersStats($serverService);
        $this->newLine();

        // Applications Statistics
        $this->displayApplicationsStats();
        $this->newLine();

        // Revenue Statistics
        $this->displayRevenueStats();
        $this->newLine();

        if ($this->option('detailed')) {
            $this->displayDetailedStats();
        }

        return Command::SUCCESS;
    }

    private function displayUsersStats(): void
    {
        $totalUsers = User::count();
        $admins = User::where('idem_role', 'admin')->count();
        $members = User::where('idem_role', 'member')->count();
        $recentUsers = User::where('created_at', '>=', now()->subDays(30))->count();

        $this->info('👥 Users');
        $this->table(
            ['Metric', 'Count'],
            [
                ['Total Users', $totalUsers],
                ['Admins', $admins],
                ['Members', $members],
                ['New (Last 30 days)', $recentUsers],
            ]
        );
    }

    private function displayTeamsStats(): void
    {
        $totalTeams = Team::count();
        $freeTeams = Team::where('idem_subscription_plan', 'free')->count();
        $basicTeams = Team::where('idem_subscription_plan', 'basic')->count();
        $proTeams = Team::where('idem_subscription_plan', 'pro')->count();
        $enterpriseTeams = Team::where('idem_subscription_plan', 'enterprise')->count();

        $this->info('🏢 Teams by Subscription Plan');
        $this->table(
            ['Plan', 'Count', 'Percentage'],
            [
                ['Total', $totalTeams, '100%'],
                ['Free', $freeTeams, $totalTeams > 0 ? round(($freeTeams / $totalTeams) * 100, 1) . '%' : '0%'],
                ['Basic', $basicTeams, $totalTeams > 0 ? round(($basicTeams / $totalTeams) * 100, 1) . '%' : '0%'],
                ['Pro', $proTeams, $totalTeams > 0 ? round(($proTeams / $totalTeams) * 100, 1) . '%' : '0%'],
                ['Enterprise', $enterpriseTeams, $totalTeams > 0 ? round(($enterpriseTeams / $totalTeams) * 100, 1) . '%' : '0%'],
            ]
        );
    }

    private function displayServersStats(IdemServerService $serverService): void
    {
        $totalServers = Server::count();
        $managedServers = Server::where('idem_managed', true)->count();
        $personalServers = Server::where('idem_managed', false)->count();
        
        $managedStats = $serverService->getManagedServerStats();

        $this->info('🖥️  Servers');
        $this->table(
            ['Metric', 'Count'],
            [
                ['Total Servers', $totalServers],
                ['IDEM Managed', $managedServers],
                ['Personal Servers', $personalServers],
                ['Managed Online', $managedStats['online_servers']],
                ['Managed Offline', $managedStats['offline_servers']],
                ['Avg Load Score', $managedStats['average_load']],
            ]
        );
    }

    private function displayApplicationsStats(): void
    {
        $totalApps = Application::count();
        $runningApps = Application::where('status', 'running')->count();

        $this->info('🚀 Applications');
        $this->table(
            ['Metric', 'Count'],
            [
                ['Total Applications', $totalApps],
                ['Running', $runningApps],
                ['Stopped', $totalApps - $runningApps],
            ]
        );
    }

    private function displayRevenueStats(): void
    {
        $monthlyRevenue = $this->calculateMonthlyRevenue();
        $yearlyRevenue = $monthlyRevenue * 12;

        $this->info('💰 Revenue (Estimated)');
        $this->table(
            ['Period', 'Revenue'],
            [
                ['Monthly (MRR)', '$' . number_format($monthlyRevenue, 2)],
                ['Yearly (ARR)', '$' . number_format($yearlyRevenue, 2)],
            ]
        );

        // Revenue by plan
        $revenueByPlan = $this->calculateRevenueByPlan();
        if (!empty($revenueByPlan)) {
            $this->newLine();
            $this->line('Revenue Breakdown by Plan:');
            $rows = [];
            foreach ($revenueByPlan as $plan => $data) {
                $rows[] = [
                    ucfirst($plan),
                    $data['teams_count'],
                    '$' . number_format($data['monthly_revenue'], 2),
                ];
            }
            $this->table(['Plan', 'Teams', 'Monthly Revenue'], $rows);
        }
    }

    private function displayDetailedStats(): void
    {
        $this->newLine();
        $this->info('📈 Detailed Statistics');
        $this->newLine();

        // Top teams by app count
        $topTeams = Team::withCount('applications')
            ->orderBy('applications_count', 'desc')
            ->limit(5)
            ->get();

        if ($topTeams->isNotEmpty()) {
            $this->line('Top 5 Teams by Application Count:');
            $rows = [];
            foreach ($topTeams as $team) {
                $rows[] = [$team->name, $team->applications_count, $team->idem_subscription_plan];
            }
            $this->table(['Team', 'Apps', 'Plan'], $rows);
        }
    }

    private function calculateMonthlyRevenue(): float
    {
        $revenue = 0;

        foreach (['basic', 'pro', 'enterprise'] as $planName) {
            $plan = IdemSubscriptionPlan::findByName($planName);
            if ($plan) {
                $teamsCount = Team::where('idem_subscription_plan', $planName)->count();
                $planRevenue = $plan->billing_period === 'monthly' 
                    ? $plan->price 
                    : $plan->price / 12;
                $revenue += $teamsCount * $planRevenue;
            }
        }

        return round($revenue, 2);
    }

    private function calculateRevenueByPlan(): array
    {
        $breakdown = [];

        foreach (['basic', 'pro', 'enterprise'] as $planName) {
            $plan = IdemSubscriptionPlan::findByName($planName);
            if ($plan) {
                $teamsCount = Team::where('idem_subscription_plan', $planName)->count();
                $planRevenue = $plan->billing_period === 'monthly' 
                    ? $plan->price 
                    : $plan->price / 12;
                $breakdown[$planName] = [
                    'teams_count' => $teamsCount,
                    'monthly_revenue' => round($teamsCount * $planRevenue, 2),
                ];
            }
        }

        return $breakdown;
    }
}
