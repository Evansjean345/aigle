import { Reader, type ReaderModel } from '@maxmind/geoip2-node'
import path from 'node:path'
import fs from 'node:fs'
import app from '@adonisjs/core/services/app'
import errorLog from '#shared/infrastructure/logging/error_log'

export interface GeoIpLocation {
  countryCode?: string
  city?: string
  isVpn: boolean
  ip?: string
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    GeoIpService: GeoIpService
  }
}

export const PROXY_ORGANIZATIONS = [
  // Termes techniques
  'hosting',
  'cloud',
  'datacenter',
  'data center',
  'vps',
  'server',
  'dedicated',
  'infrastructure',
  'compute',
  'networks',
  'systems',
  'solutions',

  // Géants du Web (ASN names)
  'amazon',
  'aws',
  'google',
  'azure',
  'microsoft',
  'oracle',
  'alibaba',
  'softlayer',
  'ibm',

  'packethub', // NordVPN
  'tefincom', // NordVPN
  'cloudvpn', // VPN divers
  'pangeo', // Proxys
  'm247', // Infrastructure VPN mondiale
  'choopa', // Vultr / VPN
  'tata communications',
  'cogent',
  'leaseweb',

  // Hébergeurs mondiaux
  'akamai',
  'linode',
  'digitalocean',
  'ovh',
  'hetzner',
  'vultr',
  'leaseweb',
  'clouway',
  'liquidweb',
  'ionos',
  'godaddy',
  'fastly',
  'cloudflare',
  'namesilo',
  'namecheap',
  'contabo',
  'scaleway',
  'a2hosting',
  'hostinger',
  'siteground',

  // Sécurité et Anonymat
  'vpn',
  'proxy',
  'tunnel',
  'private internet',
  'mullvad',
  'expressvpn',
  'nordvpn',
  'surfshark',
  'tor exit',
] as const

export default class GeoIpService {
  private cityReader: ReaderModel | null = null
  private asnReader: ReaderModel | null = null
  private isInitializing: boolean = false
  private initializationPromise: Promise<void> | null = null

  constructor() {
    console.log('Initializing GeoIP Service...')
    this.initializationPromise = this.initializeReaders()
  }

  /**
   * Initializes the MaxMind GeoIP readers for City and ASN databases.
   * This reads the database file paths from the environment configuration,
   * constructs the absolute paths, and attempts to open the corresponding database files.
   * If the files exist, it loads them into their respective readers.
   * Logs an error message if an issue occurs during initialization.
   *
   * @return {Promise<void>} A promise that resolves when the readers are successfully initialized.
   */
  private async initializeReaders(): Promise<void> {
    if (this.isInitializing) return this.initializationPromise!
    this.isInitializing = true

    const dbPath = 'geo-database'
    const absolutePath = path.isAbsolute(dbPath) ? dbPath : app.makePath(dbPath)

    const cityDbFile = path.join(absolutePath, 'GeoLite2-City.mmdb')
    const asnDbFile = path.join(absolutePath, 'GeoLite2-ASN.mmdb')

    try {
      if (fs.existsSync(cityDbFile)) {
        this.cityReader = await Reader.open(cityDbFile)
      } else {
        console.warn(`[GeoIpService] City database file not found at ${cityDbFile}`)
      }

      if (fs.existsSync(asnDbFile)) {
        this.asnReader = await Reader.open(asnDbFile)
        console.log('[GeoIpService] ASN database loaded successfully')
      } else {
        console.warn(`[GeoIpService] ASN database file not found at ${asnDbFile}`)
      }
    } catch (err) {
      errorLog.error(
        'FAILED_INITIALISE_MAXMIND_SERVICE',
        {
          error: err,
        },
        err.message
      )
    } finally {
      this.isInitializing = false
    }
  }

  /**
   * Ensures that the readers are initialized before use. If the initialization process
   * is already ongoing, it waits for the completion of the existing promise. Otherwise,
   * it starts the initialization process.
   *
   * @return {Promise<void>} A promise that resolves once the readers are initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.cityReader && this.asnReader) return

    if (this.initializationPromise) {
      await this.initializationPromise
    } else {
      this.initializationPromise = this.initializeReaders()
      await this.initializationPromise
    }
  }

  /**
   * Retrieves the geographical location metadata for a given IP address.
   * The metadata includes the country code, city name, and whether the IP is associated with a VPN or proxy.
   *
   * @param {string} ip - The IP address to look up the geographical location for.
   *                      It should be a valid IPv4 or IPv6 string. Localhost IPs ('127.0.0.1' or '::1') will return default results.
   * @return {Promise<GeoIpLocation>} A promise that resolves to an object containing the country code, city name, and a boolean indicating VPN usage.
   */
  async getLocation(ip: string): Promise<GeoIpLocation> {
    const result: GeoIpLocation = {
      ip: undefined,
      countryCode: undefined,
      city: undefined,
      isVpn: false,
    }

    if (!ip || ip === '127.0.0.1' || ip === '::1') {
      result.ip = ip || '127.0.0.1'
      return result
    }

    await this.ensureInitialized()

    try {
      if (this.cityReader) {
        const response = this.cityReader.city(ip)

        result.countryCode = response.country?.isoCode
        result.city = response.city?.names?.en
        result.ip = ip
      }

      if (this.asnReader) {
        const response = this.asnReader.asn(ip)
        const organization =
          response.autonomousSystemOrganization?.toLowerCase().replace(/[^a-z0-9 ]/g, '') || ''

        result.isVpn = PROXY_ORGANIZATIONS.some((org) => organization.includes(org))
      }
    } catch (error) {}

    return result
  }

  /**
   * Determines if the given IP address belongs to a proxy, VPN, hosting provider, or data center.
   *
   * @param {string} ip - The IP address to check.
   * @return {Promise<boolean>} A promise that resolves to `true` if the IP is associated with a proxy, VPN, hosting, or data center, otherwise `false`.
   */
  async isProxy(ip: string): Promise<boolean> {
    if (!this.asnReader || !ip) return false

    try {
      const response = this.asnReader.asn(ip)
      const organization = response.autonomousSystemOrganization?.toLowerCase() || ''
      return PROXY_ORGANIZATIONS.some((org) => organization.includes(org))
    } catch {
      return false
    }
  }
}
