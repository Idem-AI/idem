#!/bin/bash

# Installation Stripe SDK pour IDEM SaaS
echo "📦 Installation de Stripe SDK..."

if composer show stripe/stripe-php &> /dev/null; then
    echo "✅ Stripe SDK déjà installé"
else
    composer require stripe/stripe-php --no-interaction
    echo "✅ Stripe SDK installé avec succès"
fi
