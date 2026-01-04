import { cuid } from '@adonisjs/core/helpers'

export default class FileStorageService {
  /**
   * Upload file to S3 bucket
   *
   * @param filePath
   * @param destinationPath
   */
  async uploadFile(filePath: any, destinationPath: string): Promise<string> {
    const key = `${destinationPath}/${cuid()}.${filePath.extname}`
    await filePath.moveToDisk(key, 's3')
    return filePath.meta.url
  }
}
