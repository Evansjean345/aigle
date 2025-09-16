export default class ResponseFormatter {
  static create({
    data = null,
    message,
    code = 200,
    error = null,
    status = true,
  }: {
    data?: any | null
    message: string
    code?: number
    error?: any
    status?: boolean
    access?: boolean
  }) {
    return {
      data,
      message,
      code,
      error,
      status,
    }
  }
}
