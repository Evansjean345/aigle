export interface WebhookResponseDto {
  status: boolean
  message: string
  data: {
    reference: string
    result: string
  }
}
