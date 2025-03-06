#!/bin/bash

# Arrêter le script en cas d'erreur
set -e  

echo "🚀 Démarrage du build d'AdonisJS..."

# Construire le projet AdonisJS
npm run build

echo "✅ Build terminé avec succès !"

# Définir l'emplacement de destination (où le build final sera stocké)
DESTINATION="./build"  # Modifier selon tes besoins

# Supprimer l'ancien dossier s'il existe
rm -rf $DESTINATION

# Copier tout le dossier build vers la destination
cp -r build $DESTINATION

# Copier un fichier spécifique de la racine vers le build (ex: .env, config.json...)
FICHIER_A_COPIER=".env"  # Modifier selon le fichier à copier
cp $FICHIER_A_COPIER $DESTINATION

echo "📂 Copie terminée : $FICHIER_A_COPIER a été ajouté à $DESTINATION/build"

# Optionnel : Afficher la structure finale
ls -lah $DESTINATION/build

echo "🚀 Déploiement terminé avec succès !"
