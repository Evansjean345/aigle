import { cuid } from '@adonisjs/core/helpers'

export const generateUrl = (ext: string) => {
  let key = `${cuid()}.${ext}`
  return key
}
