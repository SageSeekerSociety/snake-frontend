export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  error?: {
    type: string;
    details: any;
  };
}

export interface BatchExecutionItem {
  userId: number;
  inputData?: string;
  clientRequestId: string;
  cpuTimeLimitSeconds?: number;
  memoryLimitKb?: number;
  wallTimeLimitSeconds?: number;
  sessionId?: string;
  tickNumber?: number;
}


// Define the expected structure of data coming in SSE events (from backend's JobSseEvent)
export interface SseEventData {
  jobId: string;
  eventType: string; // "SUBMITTED", "STATUS_UPDATE", "FINAL_RESULT", "ERROR"
  status?: string; // JobStatus as string
  message?: string;
  data?: any; // Specific data payload, might contain clientKey, output etc.
}

export type JobSubmissionResponse = ApiResponse<{
  jobId: string;
}>;

export type BatchSubmissionResponse = ApiResponse<{
  sessionId: string;
  jobs: {
    [key: string]: {
      status: string;
      jobId: string;
    };
  };
}>;

export interface JobResultDto {
  jobId: string;
  userId: number;
  status: 'PENDING' | 'SUBMITTED' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'ERROR';
  submitTime: string; // ISO 8601 string
  endExecutionTime?: string; // ISO 8601 string
  programOutput?: string;
  cpuTimeSeconds?: number;
  memoryKb?: number;
  exitCode?: number;
  errorDetails?: string;
}

export type JobResultResponse = ApiResponse<JobResultDto>;
