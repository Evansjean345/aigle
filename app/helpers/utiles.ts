export const uniqueID = (length: number): string => {
  let randomID = ''

  // Générer un numéro aléatoire composé uniquement de chiffres
  for (let i = 0; i < length; i++) {
    randomID += Math.floor(Math.random() * 10) // Génère un chiffre aléatoire entre 0 et 9
  }

  return randomID
}
