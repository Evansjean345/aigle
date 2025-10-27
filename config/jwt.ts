import env from '#start/env'

export const jwtSecret = env.get('JWT_SECRET')
export const jwtAlg = env.get('JWT_ALG')
