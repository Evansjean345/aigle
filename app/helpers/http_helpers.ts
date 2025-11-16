// app/Helpers/HttpHelper.ts

import axios, { AxiosInstance } from 'axios'
import chalk from 'chalk'

export const baseURL: AxiosInstance = axios.create({
  baseURL: process.env.API_BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
})

// Ajout de l'intercepteur pour les tokens
baseURL.interceptors.request.use((config) => {
  // const token = getTokenFromCookies()
  config.headers['Authorization'] = `Bearer ${process.env.AIGLE_HUB_SECRET}`
  config.headers['MarchandId'] = `${process.env.AIGLE_HUB_API_KEY}`
  return config
})

/**
 * Helper pour récupérer le token dans les cookies (ou toute autre source)
 */
export function getTokenFromCookies(): string | null {
  // Exemple : à adapter selon ton contexte
}

/**
 * Helper pour exécuter une requête HTTP
 */
export async function makeRequest({
  uri = '',
  method = 'GET',
  headers = {},
  data = {},
  params = {},
}: {
  uri: string
  method: string
  headers?: any
  data?: any
  params?: any
}) {
  const options = {
    url: uri,
    method,
    headers,
    data,
    params,
  }

  try {
    // console.log('Données envoyées :', {
    //   key: 'value',
    // })
    const response = await baseURL.request(options)

    return {
      success: true,
      data: response.data,
    }
  } catch (error) {
    // Vérifiez si l'erreur a une réponse pour récupérer le message d'erreur
    // console.error('************error****************')
    // console.error(chalk.red('Erreur lors de la requête :', error))
    // console.error('************error****************')

    const errorResponse = error.response ? error.response.data : { message: 'Erreur réseau' }
    return {
      success: false,
      error: errorResponse,
    }
  }
}
