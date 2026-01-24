.PHONY: help install start stop restart logs clean test

# Couleurs pour les messages
BLUE := \033[0;34m
GREEN := \033[0;32m
NC := \033[0m # No Color

help: ## Afficher l'aide
	@echo "$(BLUE)Commandes disponibles pour Coolify (mode local):$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'

install: ## Installer et configurer Coolify
	@echo "$(BLUE)🚀 Installation de Coolify...$(NC)"
	./scripts/run-local.sh

start: ## Démarrer tous les services
	@echo "$(BLUE)🚀 Démarrage de tous les services...$(NC)"
	./scripts/start-all.sh

start-dev: ## Démarrer tous les services avec Vite dev server
	@echo "$(BLUE)🚀 Démarrage de tous les services (mode dev)...$(NC)"
	./scripts/start-all.sh --dev

stop: ## Arrêter tous les services
	@echo "$(BLUE)🛑 Arrêt de tous les services...$(NC)"
	./scripts/stop-all.sh

restart: stop start ## Redémarrer tous les services

serve: ## Démarrer uniquement le serveur web
	@echo "$(BLUE)🌐 Démarrage du serveur web...$(NC)"
	php artisan serve --host=0.0.0.0 --port=8000

queue: ## Démarrer le queue worker
	@echo "$(BLUE)⚙️  Démarrage du queue worker...$(NC)"
	php artisan queue:work --tries=3

horizon: ## Démarrer Laravel Horizon
	@echo "$(BLUE)🔭 Démarrage de Horizon...$(NC)"
	php artisan horizon

dev: ## Démarrer Vite dev server
	@echo "$(BLUE)⚡ Démarrage de Vite...$(NC)"
	npm run dev

build: ## Compiler les assets pour production
	@echo "$(BLUE)🎨 Compilation des assets...$(NC)"
	npm run build

logs: ## Afficher les logs Laravel
	@tail -f storage/logs/laravel.log

logs-web: ## Afficher les logs du serveur web
	@tail -f storage/logs/services/web.log

logs-queue: ## Afficher les logs de la queue
	@tail -f storage/logs/services/queue.log

logs-horizon: ## Afficher les logs de Horizon
	@tail -f storage/logs/services/horizon.log

db-migrate: ## Exécuter les migrations
	@echo "$(BLUE)🔄 Exécution des migrations...$(NC)"
	php artisan migrate

db-fresh: ## Réinitialiser la base de données
	@echo "$(BLUE)🗄️  Réinitialisation de la base de données...$(NC)"
	php artisan migrate:fresh --seed

db-seed: ## Remplir la base de données
	@echo "$(BLUE)🌱 Remplissage de la base de données...$(NC)"
	php artisan db:seed

cache-clear: ## Vider tous les caches
	@echo "$(BLUE)🧹 Nettoyage des caches...$(NC)"
	php artisan cache:clear
	php artisan config:clear
	php artisan route:clear
	php artisan view:clear

optimize: ## Optimiser l'application
	@echo "$(BLUE)⚡ Optimisation de l'application...$(NC)"
	php artisan optimize

test: ## Exécuter les tests
	@echo "$(BLUE)🧪 Exécution des tests...$(NC)"
	php artisan test

tinker: ## Ouvrir Laravel Tinker
	@php artisan tinker

clean: ## Nettoyer les fichiers temporaires
	@echo "$(BLUE)🧹 Nettoyage...$(NC)"
	rm -rf storage/logs/services/*.log
	rm -rf storage/logs/services/*.pid
	rm -rf bootstrap/cache/*.php

status: ## Afficher le statut des services
	@echo "$(BLUE)📊 Statut des services:$(NC)"
	@echo ""
	@if [ -f storage/logs/services/web.pid ]; then \
		PID=$$(cat storage/logs/services/web.pid); \
		if ps -p $$PID > /dev/null 2>&1; then \
			echo "$(GREEN)✅ Serveur web (PID: $$PID)$(NC)"; \
		else \
			echo "❌ Serveur web (arrêté)"; \
		fi \
	else \
		echo "❌ Serveur web (non démarré)"; \
	fi
	@if [ -f storage/logs/services/queue.pid ]; then \
		PID=$$(cat storage/logs/services/queue.pid); \
		if ps -p $$PID > /dev/null 2>&1; then \
			echo "$(GREEN)✅ Queue worker (PID: $$PID)$(NC)"; \
		else \
			echo "❌ Queue worker (arrêté)"; \
		fi \
	else \
		echo "❌ Queue worker (non démarré)"; \
	fi
	@if [ -f storage/logs/services/horizon.pid ]; then \
		PID=$$(cat storage/logs/services/horizon.pid); \
		if ps -p $$PID > /dev/null 2>&1; then \
			echo "$(GREEN)✅ Horizon (PID: $$PID)$(NC)"; \
		else \
			echo "❌ Horizon (arrêté)"; \
		fi \
	else \
		echo "❌ Horizon (non démarré)"; \
	fi
	@echo ""
	@echo "$(BLUE)Services système:$(NC)"
	@brew services list | grep -E "(postgresql@15|redis)" || echo "Aucun service trouvé"

composer-install: ## Installer les dépendances PHP
	@echo "$(BLUE)📦 Installation des dépendances PHP...$(NC)"
	composer install

composer-update: ## Mettre à jour les dépendances PHP
	@echo "$(BLUE)📦 Mise à jour des dépendances PHP...$(NC)"
	composer update

npm-install: ## Installer les dépendances Node.js
	@echo "$(BLUE)📦 Installation des dépendances Node.js...$(NC)"
	npm install

npm-update: ## Mettre à jour les dépendances Node.js
	@echo "$(BLUE)📦 Mise à jour des dépendances Node.js...$(NC)"
	npm update
