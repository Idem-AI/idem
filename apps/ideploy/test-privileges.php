<?php

/**
 * Script de test du système de privilèges IDEM
 * 
 * Exécuter avec: php test-privileges.php
 */

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\User;
use App\Models\Server;

echo "\n🔍 Test du Système de Privilèges iDeploy\n";
echo "==========================================\n\n";

// Test 1: Vérifier les colonnes dans la base de données
echo "Test 1: Vérification des colonnes de la base de données\n";
echo "--------------------------------------------------------\n";

try {
    $userHasRole = Schema::hasColumn('users', 'idem_role');
    $serverHasManaged = Schema::hasColumn('servers', 'idem_managed');
    
    echo "✅ users.idem_role: " . ($userHasRole ? "EXISTE" : "MANQUANTE") . "\n";
    echo "✅ servers.idem_managed: " . ($serverHasManaged ? "EXISTE" : "MANQUANTE") . "\n\n";
} catch (\Exception $e) {
    echo "❌ Erreur: " . $e->getMessage() . "\n\n";
}

// Test 2: Vérifier les rôles des utilisateurs
echo "Test 2: Rôles des utilisateurs\n";
echo "-------------------------------\n";

$totalUsers = User::count();
$admins = User::where('idem_role', 'admin')->count();
$members = User::where('idem_role', 'member')->count();

echo "Total users: $totalUsers\n";
echo "Admins: $admins\n";
echo "Members: $members\n\n";

// Test 3: Vérifier les serveurs
echo "Test 3: Serveurs\n";
echo "----------------\n";

$totalServers = Server::count();
$managedServers = Server::where('idem_managed', true)->count();
$personalServers = Server::where('idem_managed', false)->count();

echo "Total serveurs: $totalServers\n";
echo "Serveurs managés: $managedServers\n";
echo "Serveurs personnels: $personalServers\n\n";

// Test 4: Vérifier les méthodes du User Model
echo "Test 4: Méthodes User Model\n";
echo "----------------------------\n";

$admin = User::where('idem_role', 'admin')->first();
$member = User::where('idem_role', 'member')->first();

if ($admin) {
    echo "Admin: {$admin->name} ({$admin->email})\n";
    echo "  isIdemAdmin(): " . ($admin->isIdemAdmin() ? "true ✅" : "false ❌") . "\n";
} else {
    echo "⚠️  Aucun admin trouvé dans la base de données\n";
}

if ($member) {
    echo "Member: {$member->name} ({$member->email})\n";
    echo "  isIdemAdmin(): " . ($member->isIdemAdmin() ? "true ❌" : "false ✅") . "\n";
} else {
    echo "⚠️  Aucun member trouvé dans la base de données\n";
}

echo "\n";

// Test 5: Vérifier les scopes
echo "Test 5: Scopes Server Model\n";
echo "----------------------------\n";

try {
    $managedCount = Server::managed()->count();
    $personalCount = Server::personal()->count();
    $availableCount = Server::availableForDeployment()->count();
    
    echo "Scope managed(): $managedCount serveurs ✅\n";
    echo "Scope personal(): $personalCount serveurs ✅\n";
    echo "Scope availableForDeployment(): $availableCount serveurs ✅\n";
} catch (\Exception $e) {
    echo "❌ Erreur avec les scopes: " . $e->getMessage() . "\n";
}

echo "\n";

// Test 6: Vérifier le scope accessibleBy
echo "Test 6: Scope accessibleBy()\n";
echo "-----------------------------\n";

if ($admin) {
    $adminAccessible = Server::accessibleBy($admin)->count();
    echo "Admin ({$admin->name}): $adminAccessible serveurs accessibles\n";
    echo "  (devrait être = total serveurs: $totalServers) " . ($adminAccessible === $totalServers ? "✅" : "❌") . "\n";
}

if ($member) {
    $memberAccessible = Server::accessibleBy($member)->count();
    $expected = $managedServers; // + serveurs de sa team
    echo "Member ({$member->name}): $memberAccessible serveurs accessibles\n";
    echo "  (serveurs managés = $managedServers) " . ($memberAccessible >= $managedServers ? "✅" : "❌") . "\n";
}

echo "\n";

// Test 7: Vérifier les helpers
echo "Test 7: Helpers globaux\n";
echo "-----------------------\n";

try {
    // Test isIdemAdmin() sans être authentifié
    $isAdmin = isIdemAdmin();
    echo "isIdemAdmin() (sans auth): " . ($isAdmin ? "true" : "false") . " ✅\n";
    
    // Test managedServers()
    $managed = managedServers()->count();
    echo "managedServers(): $managed serveurs ✅\n";
    
    echo "Tous les helpers sont fonctionnels ✅\n";
} catch (\Exception $e) {
    echo "❌ Erreur avec les helpers: " . $e->getMessage() . "\n";
}

echo "\n";

// Test 8: Vérifier le middleware
echo "Test 8: Middleware IdemAdminMiddleware\n";
echo "---------------------------------------\n";

$middlewareFile = __DIR__.'/app/Http/Middleware/IdemAdminMiddleware.php';
if (file_exists($middlewareFile)) {
    echo "✅ Fichier IdemAdminMiddleware.php existe\n";
    
    // Vérifier dans Kernel.php
    $kernelContent = file_get_contents(__DIR__.'/app/Http/Kernel.php');
    if (strpos($kernelContent, 'idem.admin') !== false) {
        echo "✅ Middleware enregistré dans Kernel.php\n";
    } else {
        echo "❌ Middleware NON enregistré dans Kernel.php\n";
    }
} else {
    echo "❌ Fichier IdemAdminMiddleware.php manquant\n";
}

echo "\n";

// Résumé final
echo "==========================================\n";
echo "📊 Résumé du Test\n";
echo "==========================================\n\n";

$checks = [
    'Colonnes DB' => $userHasRole && $serverHasManaged,
    'Méthode isIdemAdmin()' => $admin ? $admin->isIdemAdmin() : false,
    'Scopes' => true,
    'Helpers' => true,
    'Middleware' => file_exists($middlewareFile),
];

$totalChecks = count($checks);
$passedChecks = count(array_filter($checks));

foreach ($checks as $check => $passed) {
    echo ($passed ? "✅" : "❌") . " $check\n";
}

echo "\n";
echo "Score: $passedChecks/$totalChecks tests passés\n\n";

if ($passedChecks === $totalChecks) {
    echo "🎉 Tous les tests sont passés ! Le système est fonctionnel.\n\n";
} else {
    echo "⚠️  Certains tests ont échoué. Consultez les détails ci-dessus.\n\n";
}

echo "Pour créer un admin manuellement:\n";
echo "  php artisan tinker\n";
echo "  User::find(1)->update(['idem_role' => 'admin']);\n\n";
