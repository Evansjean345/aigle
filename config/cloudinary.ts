import env from '#start/env'

export const cloudName = env.get('CLOUDINARY_CLOUD_NAME')
export const apiKey = env.get('CLOUDINARY_API_KEY')
export const apiSecret = env.get('CLOUDINARY_API_SECRET')
