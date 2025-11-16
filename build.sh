#!/bin/bash
set -e  # Arrêter en cas d'erreur

echo "🚀 Démarrage du build d'AdonisJS..."

# Construire le projet AdonisJS
npm run build
echo "✅ Build terminé avec succès !"

# Définir l’emplacement du build final à l’extérieur du dossier courant
DESTINATION="build"

echo "📂 Préparation du dossier de déploiement : $DESTINATION"

# Copier un fichier supplémentaire (ex: .env)
FICHIER_A_COPIER=".env"
cp $FICHIER_A_COPIER $DESTINATION

echo "📂 Copie terminée : $FICHIER_A_COPIER a été ajouté à $DESTINATION"

cd $DESTINATION

echo "📦 Installation des dépendances de production (npm ci --omit=dev)..."
npm ci --omit=dev

echo "🚀 Déploiement terminé avec succès !"

# Redémarrer l'application via PM2
APP_NAME="aiglesend.fintect-aigle.com"  # 🔁 Remplace par le nom défini dans PM2
echo "🔄 Redémarrage de l'application PM2 ($APP_NAME)..."
pm2 restart $APP_NAME --update-env

echo "✅ Application redémarrée avec succès via PM2"
echo "🚀 Déploiement terminé avec succès !"
