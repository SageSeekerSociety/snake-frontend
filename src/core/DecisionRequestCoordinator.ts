import { SSE } from "sse.js"; // Assuming sse.js library
import { BatchExecutionItem, SseEventData } from "../types/Api"; // Define your BatchExecutionItem type
import { sandboxService } from "../services/api";
import { RateLimitError } from "../types/RateLimitError";

// Type for the data passed when resolving the decision promise
export interface DecisionData {
  success: boolean;
  output: string | null;
  stderr: string | null;
  status: string; // SUCCESS, TLE, MLE, RE, ERROR etc.
  error?: string;
  cpuTimeSeconds?: number;
  memoryKb?: number;
  newMemoryData?: string;
  workerNodeId?: string;
  jobId?: string;
}

// Type for the function stored in the promise map
type PromiseResolver = {
  resolve: (value: DecisionData) => void;
  reject: (reason?: any) => void;
};

/**
 * Orchestrates batching of decision requests, manages the SSE connection lifecycle,
 * and resolves promises based on incoming real-time events.
 * This class is stateful and self-contained.
 */
export class DecisionRequestCoordinator {
  private requestQueue: Array<{
    item: BatchExecutionItem;
    resolver: PromiseResolver;
  }> = [];
  private activePromises: Map<string, PromiseResolver> = new Map();
  private activeSseConnection: SSE | null = null;
  private batchSendScheduled: boolean = false;
  private pendingResultsCount: number = 0;
  
  // 重试配置
  private readonly MAX_RETRY_ATTEMPTS = 5;
  private readonly BASE_DELAY_MS = 1000;
  private readonly MAX_JITTER_MS = 200;

  /**
   * Queues a decision request from a strategy. This is the main entry point.
   * @param item - The fully populated execution item, including sessionId and tickNumber.
   * @returns A promise that will be resolved when the result for this specific request arrives.
   */
  public requestDecision(item: BatchExecutionItem): Promise<DecisionData> {
    if (!item.clientRequestId) {
      return Promise.reject(
        new Error("BatchExecutionItem must have a clientRequestId.")
      );
    }
    const clientKey = item.clientRequestId;

    if (this.activePromises.has(clientKey)) {
      console.warn(
        `Duplicate decision request for active clientRequestId: ${clientKey}.`
      );
      return Promise.reject(
        new Error(`Duplicate active request for ${clientKey}`)
      );
    }

    const promise = new Promise<DecisionData>((resolve, reject) => {
      this.requestQueue.push({ item, resolver: { resolve, reject } });
    });

    if (!this.batchSendScheduled) {
      this.batchSendScheduled = true;
      queueMicrotask(() => {
        this.dispatchQueuedRequests();
        this.batchSendScheduled = false;
      });
    }
    return promise;
  }

  /**
   * 计算重试延迟时间（包含 jitter）
   */
  private calculateRetryDelay(attempt: number, retryAfterSeconds?: number): number {
    let baseDelay: number;
    
    if (retryAfterSeconds) {
      // 如果服务器指定了 Retry-After，使用该值作为基础延迟
      baseDelay = retryAfterSeconds * 1000;
    } else {
      // 指数退避：1s, 2s, 4s, 8s, 16s
      baseDelay = this.BASE_DELAY_MS * Math.pow(2, attempt - 1);
    }
    
    // 添加随机 jitter (0-200ms)
    const jitter = Math.random() * this.MAX_JITTER_MS;
    return baseDelay + jitter;
  }

  /**
   * 等待指定时间
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Processes the queue, submits a batch, and establishes the SSE connection if not already active.
   */
  private async dispatchQueuedRequests(): Promise<void> {
    if (this.requestQueue.length === 0) return;

    const batchToProcess = [...this.requestQueue];
    this.requestQueue = [];

    this.pendingResultsCount += batchToProcess.length;
    batchToProcess.forEach((req) => {
      this.activePromises.set(req.item.clientRequestId, req.resolver);
    });

    const batchItems = batchToProcess.map((req) => req.item);

    // 带重试的批量提交
    await this.submitBatchWithRetry(batchItems);
  }

  /**
   * 带重试机制的批量提交
   */
  private async submitBatchWithRetry(batchItems: BatchExecutionItem[]): Promise<void> {
    let attempt = 1;
    let lastError: any = null;

    while (attempt <= this.MAX_RETRY_ATTEMPTS) {
      try {
        // Step 1: Submit the batch
        await sandboxService.submitBatchExecution(batchItems);

        // Step 2: Establish the SSE connection on the very first batch submission
        if (!this.activeSseConnection) {
          const sessionId = batchItems[0]?.sessionId;
          if (!sessionId)
            throw new Error("Session ID is missing in the first batch.");

          this.activeSseConnection = sandboxService.listenToExecutionStream(
            sessionId,
            0, // Always listen from the beginning of the game.
            (eventData) => this.handleSseEvent(eventData),
            (error) => this.handleSseConnectionError(error)
          );
        }

        // 成功，退出重试循环
        return;
        
      } catch (error) {
        lastError = error;
        
        // 检查是否是 Rate Limit 错误
        if (error instanceof RateLimitError) {
          console.warn(`Coordinator: Rate limit hit (attempt ${attempt}/${this.MAX_RETRY_ATTEMPTS}), retrying...`);
          
          if (attempt < this.MAX_RETRY_ATTEMPTS) {
            const delayMs = this.calculateRetryDelay(attempt, error.retryAfterSeconds);
            console.log(`Coordinator: Waiting ${Math.round(delayMs)}ms before retry`);
            await this.delay(delayMs);
            attempt++;
            continue;
          }
        }
        
        // 非 Rate Limit 错误或重试次数用尽，直接抛出
        console.error(
          `Coordinator: Batch submission failed (attempt ${attempt}/${this.MAX_RETRY_ATTEMPTS}):`,
          error
        );
        break;
      }
    }

    // 所有重试都失败了，拒绝这批请求的 Promise
    this.rejectPromisesForBatch(batchItems, lastError || new Error('Max retry attempts reached'));
  }

  /**
   * Handles incoming SSE events, finds the corresponding promise, and resolves it.
   */
  private handleSseEvent(eventData: SseEventData): void {
    const clientKey = eventData?.data?.clientRequestId;
    if (!clientKey) {
      console.warn(
        "Coordinator: Received SSE event without clientRequestId:",
        eventData
      );
      return;
    }

    const resolver = this.activePromises.get(clientKey);
    if (!resolver) return; // Promise already handled or not found.

    let isFinal = false;
    if (
      eventData.eventType === "FINAL_RESULT" ||
      eventData.eventType === "ERROR"
    ) {
      isFinal = true;
      const result = eventData.data;
      const success = eventData.status === "SUCCESS";
      console.debug("Coordinator: SSE event received:", eventData);
      const decisionData: DecisionData = {
        success,
        output: result?.programOutput ?? null,
        stderr: result?.programStderr ?? null,
        status: eventData.status ?? "UNKNOWN",
        error: !success ? result?.errorDetails ?? eventData.message : undefined,
        cpuTimeSeconds: result?.cpuTimeSeconds,
        memoryKb: result?.memoryKb,
        newMemoryData: result?.newMemoryData ? atob(result.newMemoryData) : undefined,
        workerNodeId: result?.workerNodeId,
        jobId: result?.jobId,
      };

      resolver.resolve(decisionData);
    }

    if (isFinal) {
      this.activePromises.delete(clientKey);
      this.pendingResultsCount--;
      console.debug(
        `Coordinator: Final event for ${clientKey}. ${this.pendingResultsCount} results pending.`
      );
    }
  }

  /**
   * Handles fatal SSE connection errors, rejecting all pending promises.
   */
  private handleSseConnectionError(error: any): void {
    console.error("Coordinator: A fatal SSE Connection Error occurred:", error);
    this.rejectAllActivePromises(error);
    this.closeSseConnection();
  }

  /**
   * Rejects all promises currently awaiting a result.
   */
  private rejectAllActivePromises(reason: any): void {
    if (this.activePromises.size === 0) return;

    console.warn(
      `Coordinator: Rejecting all ${this.activePromises.size} pending promises. Reason:`,
      reason
    );
    const error =
      reason instanceof Error
        ? reason
        : new Error(reason.message || String(reason));
    this.activePromises.forEach((resolver) => resolver.reject(error));
    this.activePromises.clear();
    this.pendingResultsCount = 0;
  }

  /**
   * Rejects only the promises from a specific batch that failed to submit.
   */
  private rejectPromisesForBatch(
    batchItems: BatchExecutionItem[],
    reason: any
  ): void {
    const error =
      reason instanceof Error
        ? reason
        : new Error(reason.message || String(reason));
    batchItems.forEach((item) => {
      const resolver = this.activePromises.get(item.clientRequestId);
      if (resolver) {
        resolver.reject(error);
        this.activePromises.delete(item.clientRequestId);
        this.pendingResultsCount--;
      }
    });
  }

  private closeSseConnection(): void {
    if (this.activeSseConnection) {
      this.activeSseConnection.close();
      this.activeSseConnection = null;
      // console.log("Coordinator: SSE connection closed.");
    }
  }

  /**
   * Resets the coordinator for a new game.
   */
  public cleanup(): void {
    this.closeSseConnection();
    this.rejectAllActivePromises(new Error("Coordinator cleanup initiated."));
    this.requestQueue = [];
    this.batchSendScheduled = false;
    this.pendingResultsCount = 0;
  }
}
