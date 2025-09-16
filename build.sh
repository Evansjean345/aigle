#!/bin/bash
set -e  # Arrêter en cas d'erreur

echo "🚀 Démarrage du build d'AdonisJS..."

# Construire le projet AdonisJS
npm run build
echo "✅ Build terminé avec succès !"

# Définir l’emplacement du build final à l’extérieur du dossier courant
DESTINATION="../build"

# Supprimer l’ancien build s’il existe
rm -rf $DESTINATION

# Créer le dossier destination s’il n'existe pas (par précaution)
mkdir -p $DESTINATION

# Copier le contenu du dossier build généré par AdonisJS
cp -r build/* $DESTINATION

# Copier un fichier supplémentaire (ex: .env)
FICHIER_A_COPIER=".env"
cp $FICHIER_A_COPIER $DESTINATION

echo "📂 Copie terminée : $FICHIER_A_COPIER a été ajouté à $DESTINATION"

cd $DESTINATION

echo "📦 Installation des dépendances de production (npm ci --omit=dev)..."
npm ci --omit=dev

# Afficher la structure finale du dossier déployé
ls -lah $DESTINATION

echo "🚀 Déploiement terminé avec succès !"

# Redémarrer l'application via PM2
APP_NAME="aigle-send"  # 🔁 Remplace par le nom défini dans PM2
echo "🔄 Redémarrage de l'application PM2 ($APP_NAME)..."
pm2 restart $APP_NAME

echo "✅ Application redémarrée avec succès via PM2"
echo "🚀 Déploiement terminé avec succès !"
