export class Notification {
  constructor(
    public readonly recipientId: string,
    public readonly title: string,
    public readonly message: string,
    public readonly data?: any
  ) {}
}
