import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import app from '@adonisjs/core/services/app'
import { GeoIpLocation } from '#shared/infrastructure/geoip_service'

declare module '@adonisjs/core/http' {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  interface HttpContext {
    geoLocation: GeoIpLocation
  }
}

export default class GeoIpMiddleware {
  /**
   * Middleware to resolve GeoIP location data based on the incoming request IP address
   * and enrich the deviceInfo in HttpContext.
   *
   * @param {HttpContext} ctx - The HTTP context of the current request.
   * @param {NextFn} next - The next middleware function.
   * @return {Promise<void>}
   */
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const geoIpService = await app.container.make('GeoIpService')
    const ip = ctx.request.header('X-Ip-Test') || ctx.request.ip()

    ctx.geoLocation = await geoIpService.getLocation(ip)

    console.log('from geoip middleware:')
    console.log(ctx.geoLocation)

    return next()
  }
}
