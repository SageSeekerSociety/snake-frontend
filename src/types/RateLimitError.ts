export class RateLimitError extends Error {
  public readonly retryAfterSeconds?: number;
  public readonly isRateLimit = true;

  constructor(retryAfterSeconds?: number) {
    super('请求频率过高，请稍后重试');
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}