import { SSE } from "sse.js"; // Assuming sse.js library
import { BatchExecutionItem, SseEventData } from "../types/Api"; // Define your BatchExecutionItem type
import { sandboxService } from "../services/api";

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

    try {
      // Step 1: Always submit the batch for the current tick.
      await sandboxService.submitBatchExecution(batchItems);

      // Step 2: Establish the SSE connection on the very first batch submission.
      if (!this.activeSseConnection) {
        const sessionId = batchItems[0]?.sessionId;
        if (!sessionId)
          throw new Error("Session ID is missing in the first batch.");

        // console.log(
        //   `Establishing persistent SSE connection for session ${sessionId}...`
        // );
        this.activeSseConnection = sandboxService.listenToExecutionStream(
          sessionId,
          0, // Always listen from the beginning of the game.
          (eventData) => this.handleSseEvent(eventData),
          (error) => this.handleSseConnectionError(error)
        );
      }
    } catch (error) {
      console.error(
        "Coordinator: Batch submission or SSE initiation failed:",
        error
      );
      // If the initial submission itself fails, reject the promises for this batch.
      this.rejectPromisesForBatch(batchItems, error);
    }
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
        newMemoryData: result?.newMemoryData ? atob(result.newMemoryData) : undefined
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
