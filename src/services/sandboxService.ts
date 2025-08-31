import { sandboxClient } from "./httpClient";
import { Direction, FoodType } from "../config/GameConfig";
import { Snake } from "../entities/Snake";
import { Food } from "../entities/Food";
import { Obstacle } from "../entities/Obstacle";
import { TreasureChest } from "../entities/TreasureChest";
import { Key } from "../entities/Key";
import { SafeZoneAlgorithmInfo } from "../types/GameState";
import { PlayersResponse, Player } from "../types/User";
import { VortexFieldApiData } from "../types/VortexField";
import { SSE } from "sse.js";
import {
  BatchExecutionItem,
  SseEventData,
  JobSubmissionResponse,
  BatchSubmissionResponse,
  JobResultResponse,
} from "../types/Api";

/**
 * Service to interact with the sandbox API for code compilation and execution.
 */
export const sandboxService = {
  /**
   * Fetches the list of all players/submitters.
   * @returns A promise that resolves to an array of User objects.
   */
  getSubmitters: async (): Promise<Player[]> => {
    const response = await sandboxClient.get<PlayersResponse>("/players");
    if (response.data.code === 200) {
      return response.data.data;
    }
    throw new Error(`Failed to fetch players: ${response.data.message}`);
  },

  /**
   * Submits source code for compilation.
   * This is the first step in the compilation flow.
   * @param file The source code file to compile.
   * @param onProgress Optional callback to track upload progress.
   * @returns A promise resolving with the job ID if submission is accepted.
   */
  submitCode: async (file: File, onProgress?: (progressPercent: number) => void): Promise<string> => {
    const formData = new FormData();
    formData.append("sourceFile", file);

    const response = await sandboxClient.post<JobSubmissionResponse>(
      "/compile",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        },
      }
    );

    if (response.data.code === 202 && response.data.data.jobId) {
      return response.data.data.jobId;
    }
    throw new Error(response.data.message || "Code submission failed.");
  },

  /**
   * Creates and returns an SSE connection to listen for compilation events.
   * @param jobId The job ID to listen for.
   * @param onEvent Callback for each received SSE event.
   * @param onError Callback for connection-level errors.
   * @returns The SSE instance for manual control.
   */
  listenToCompilationStream: (
    jobId: string,
    onEvent: (eventData: SseEventData) => void,
    onError: (error: any) => void
  ): SSE => {
    const token = localStorage.getItem("accessToken");
    const sse = new SSE(
      `${sandboxClient.defaults.baseURL}/compile/stream/${jobId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    // Unified event handler
    const handleEvent = (event: MessageEvent) => {
      try {
        const parsedData: SseEventData = JSON.parse(event.data);
        onEvent(parsedData);
      } catch (err) {
        console.error("Failed to parse SSE event data:", event.data, err);
      }
    };

    sse.addEventListener("message", handleEvent);
    sse.addEventListener("FINAL_RESULT", handleEvent);

    // Handle connection-level errors (e.g., auth failure, job not found)
    sse.addEventListener("error", (errorEvent: any) => {
      console.error("SSE Connection Error:", errorEvent);
      if (errorEvent.data) {
        try {
          // Server sent a structured JSON error
          onError(JSON.parse(errorEvent.data));
        } catch {
          // Fallback for non-JSON error data
          onError({ message: "An unknown SSE error occurred." });
        }
      } else {
        onError({
          message: `Connection failed with status ${errorEvent.responseCode}.`,
        });
      }
      sse.close();
    });

    sse.stream();
    return sse;
  },

  /**
   * Submits a batch of execution requests.
   * This is a standard one-shot REST POST call.
   * @param requests The array of execution items for the current tick.
   * @returns A promise that resolves with the server's submission response.
   */
  submitBatchExecution: async (requests: BatchExecutionItem[]): Promise<BatchSubmissionResponse> => {
    if (!requests || requests.length === 0) {
      throw new Error("Execution request batch cannot be empty.");
    }
    const response = await sandboxClient.post<BatchSubmissionResponse>("/execute/batch", requests);
    if (response.data.code === 202) {
      return response.data;
    }
    // Throw an error that can be caught by the caller.
    throw new Error(response.data.message || "Batch submission failed.");
  },

  /**
   * Establishes a long-lived SSE connection to listen for session events.
   * @param sessionId The ID of the game session to listen to.
   * @param fromTick The tick number from which to start receiving events.
   * @param onEvent The callback function to handle incoming events.
   * @param onError The callback function for connection-level errors.
   * @returns The SSE instance for manual control (e.g., closing the connection).
   */
  listenToExecutionStream: (
    sessionId: string,
    fromTick: number,
    onEvent: (eventData: SseEventData) => void,
    onError: (error: any) => void
  ): SSE | null => {
    try {
      const token = localStorage.getItem("accessToken");
      const url = `${sandboxClient.defaults.baseURL}/execute/stream/${sessionId}?fromTick=${fromTick}`;

      const sse = new SSE(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const handleEvent = (event: MessageEvent) => {
        try {
          const parsedData: SseEventData = JSON.parse(event.data);
          onEvent(parsedData);
        } catch (err) {
          console.error("Failed to parse SSE event data:", event.data, err);
        }
      };

      // Listen to all relevant named events.
      sse.addEventListener("FINAL_RESULT", handleEvent);
      // Add other events like SUBMITTED if needed.
      // sse.addEventListener("SUBMITTED", handleEvent);

      sse.addEventListener("error", (errorEvent: any) => {
        console.error("SSE Connection Error:", errorEvent);
        if (errorEvent.data) {
          try {
            onError(JSON.parse(errorEvent.data)); // Handle structured error from server
          } catch {
            onError({ message: "An unknown SSE error occurred." });
          }
        } else {
          onError({ message: `Connection failed with status ${errorEvent.responseCode}.` });
        }
        sse.close();
      });

      sse.stream();
      return sse;
    } catch (error) {
      console.error("Failed to create SSE connection:", error);
      onError(error);
      return null;
    }
  },

  /**
   * Fetches the final result of a specific job.
   * @param jobId The ID of the job to query.
   * @returns A promise resolving with the job's result data.
   */
  getJobResult: async (jobId: string) => {
    const response = await sandboxClient.get<JobResultResponse>(
      `/jobs/${jobId}`
    );
    if (response.data.code === 200) {
      return response.data.data;
    }
    throw new Error(
      response.data.message || `Failed to fetch result for job ${jobId}.`
    );
  },

  /**
   * Checks the health status of the service.
   * @returns A promise resolving with the service status.
   */
  checkStatus: async () => {
    const response = await sandboxClient.get("/status");
    return response.data;
  },

  /**
   * 获取蛇的下一步行动决策
   * @param userId 用户ID
   * @param _username 用户名
   * @param gameState 游戏状态
   * @param maxRetries 最大重试次数
   * @returns 下一步方向值
   */
  getSnakeDecision: async (
    userId: number,
    _username: string,
    gameState: string,
    maxRetries: number = 2
  ): Promise<number> => {
    let retries = 0;

    while (retries <= maxRetries) {
      try {
        const response = await sandboxClient.post("/exec", {
          userIds: [userId],
          input: gameState,
        });

        // 成功响应处理
        if (
          (response.data.code === 0 || response.data.code === 200) &&
          response.data.data &&
          response.data.data.length > 0
        ) {
          const output = response.data.data[0].output?.trim() || "";

          // 检查API输出
          if (!output || response.data.data[0].error) {
            console.warn("API返回空输出或错误:", response.data.data[0].error);
            return 2; // 默认向右移动
          }

          // 解析方向值
          const directionValue = output.split(/\s+/)[0];
          const direction = parseInt(directionValue);

          // 验证方向值
          if (isNaN(direction) || direction < 0 || direction > 4) {
            console.warn("API返回无效方向:", directionValue);
            return 2; // 默认向右移动
          }

          return direction;
        }

        // API返回了错误码
        console.warn("沙盒API返回错误码:", response.data);
        return 2; // 默认向右移动
      } catch (error) {
        // 401错误将由axios拦截器自动处理刷新token并重试
        // 这里只处理其他类型的错误
        if (retries < maxRetries) {
          retries++;
          console.debug(`重试获取蛇决策 (${retries}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, 100)); // 简单延迟避免立即重试
        } else {
          console.error("获取蛇决策失败，已达到最大重试次数:", error);
          break;
        }
      }
    }

    return 2; // 默认向右移动
  },
};

/**
 * 输入格式转换：将游戏状态转换为沙盒API需要的输入格式
 */
export const formatGameStateForAPI = (
  remainingTicks: number,
  foods: Food[],
  obstacles: Obstacle[],
  snakes: Snake[],
  vortexData?: VortexFieldApiData,
  treasureChests: TreasureChest[] = [],
  keys: Key[] = [],
  safeZoneInfo?: SafeZoneAlgorithmInfo
): string => {
  let input = `${remainingTicks}\n`;

  // 特殊物品（食物、墙、宝箱、钥匙）
  const items = [...foods, ...obstacles, ...treasureChests, ...keys];
  input += `${items.length}\n`;

  // 添加食物、障碍物、宝箱、钥匙
  items.forEach((item) => {
    const pos = item.getPosition();
    const x = Math.floor(pos.x / 20);
    const y = Math.floor(pos.y / 20);

    let value, ttl = -1;
    if (item instanceof Food) {
      const foodValue = item.getValue();
      // 将不同类型的食物转换为API要求的格式
      if (item.getType() === FoodType.GROWTH) {
        value = -1; // 增长豆
      } else if (item.getType() === FoodType.TRAP) {
        value = -2; // 陷阱
      } else {
        value = Number(foodValue); // 普通食物
      }
      ttl = item.getTTL() ?? -1;
    } else if (item instanceof Key) {
      value = -3; // 钥匙
    } else if (item instanceof TreasureChest) {
      value = -5; // 宝箱
    } else {
      value = -4; // 墙
    }

    // 注意：输入格式要求 y,x 的顺序（规则里规定的坐标系统与内部实现有差异）
    input += `${y} ${x} ${value} ${ttl}\n`;
  });

  // 存活的玩家
  const aliveSnakes = snakes.filter((snake) => snake.isAlive());
  input += `${aliveSnakes.length}\n`;

  // 添加每条蛇的信息
  aliveSnakes.forEach((snake, index) => {
    const length = snake.getBody().length;
    const score = snake.getScore();
    const dir = getDirectionValue(snake.getDirection());
    const shieldCooldown = snake.getShieldCooldown();
    const shieldDuration = snake.getShieldDuration();

    const studentId = snake.getMetadata().username || index;

    input += `${studentId} ${length} ${score} ${dir} ${shieldCooldown} ${shieldDuration}\n`;

    snake.getBody().forEach((segment) => {
      const x = Math.floor(segment.x / 20);
      const y = Math.floor(segment.y / 20);
      input += `${y} ${x}\n`;
    });
  });

  // 附加涡流场信息（API兼容性设计）
  // if (vortexData) {
  //   input += `${vortexData.stateCode} ${vortexData.param1} ${vortexData.param2} ${vortexData.param3} ${vortexData.param4} ${vortexData.param5}\n`;
  // } else {
  //   // 默认非激活状态
  //   input += `0 0 0 0 0 0\n`;
  // }

  // 附加宝箱信息块
  const openTreasures = treasureChests.filter((treasure) => !treasure.isOpened());
  input += `${openTreasures.length}\n`;

  // 添加每个未开启宝箱的位置和分数
  openTreasures.forEach((treasure) => {
    const pos = treasure.getPosition();
    const x = Math.floor(pos.x / 20);
    const y = Math.floor(pos.y / 20);
    const score = treasure.getScore();
    input += `${y} ${x} ${score}\n`;
  });

  // 附加钥匙信息
  // 计算总钥匙数（地上的 + 蛇持有的）
  const groundKeys = keys;
  const heldKeysData: Array<{ x: number, y: number, studentId: string, remainingTime: number }> = [];

  // 收集蛇持有的钥匙信息
  snakes.filter(snake => snake.isAlive()).forEach((snake) => {
    if (snake.hasKey()) {
      const headPos = snake.getBody()[0];
      const x = Math.floor(headPos.x / 20);
      const y = Math.floor(headPos.y / 20);
      const studentId = snake.getMetadata().username || snake.getMetadata().studentId || 'unknown';
      const remainingTime = 40 - snake.getKeyHoldTime(); // 剩余时间

      heldKeysData.push({ x, y, studentId, remainingTime });
    }
  });

  const totalKeys = groundKeys.length + heldKeysData.length;
  input += `${totalKeys}\n`;

  // 添加地上的钥匙（没有持有者）
  groundKeys.forEach((key) => {
    const pos = key.getPosition();
    const x = Math.floor(pos.x / 20);
    const y = Math.floor(pos.y / 20);
    input += `${y} ${x} -1 0\n`; // -1表示无持有者，0表示无持有时间
  });

  // 添加蛇持有的钥匙
  heldKeysData.forEach((keyData) => {
    input += `${keyData.y} ${keyData.x} ${keyData.studentId} ${keyData.remainingTime}\n`;
  });

  // 添加安全区信息块（三层信息）
  if (safeZoneInfo) {
    // 第一行：当前安全区边界 (Current State)
    const current = safeZoneInfo.currentBounds;
    input += `${current.xMin} ${current.yMin} ${current.xMax} ${current.yMax}\n`;

    // 第二行：下次跳变信息 (Imminent Warning)
    if (safeZoneInfo.nextShrinkEvent) {
      const next = safeZoneInfo.nextShrinkEvent;
      input += `${next.startTick} ${next.targetBounds.xMin} ${next.targetBounds.yMin} ${next.targetBounds.xMax} ${next.targetBounds.yMax}\n`;
    } else {
      // 没有下次跳变，输出-1表示无跳变
      input += `-1 ${current.xMin} ${current.yMin} ${current.xMax} ${current.yMax}\n`;
    }

    // 第三行：最终目标信息 (Final Destination)
    if (safeZoneInfo.finalShrinkEvent) {
      const final = safeZoneInfo.finalShrinkEvent;
      input += `${final.startTick} ${final.targetBounds.xMin} ${final.targetBounds.yMin} ${final.targetBounds.xMax} ${final.targetBounds.yMax}\n`;
    } else {
      // 没有最终目标，输出-1表示无最终收缩
      input += `-1 ${current.xMin} ${current.yMin} ${current.xMax} ${current.yMax}\n`;
    }
  } else {
    // 兼容性：如果没有安全区信息，输出默认值
    input += `0 0 39 29\n`; // 当前边界
    input += `-1 0 0 39 29\n`; // 无下次跳变
    input += `-1 0 0 39 29\n`; // 无最终目标
  }

  return input.trim();
};

/**
 * 将游戏中的方向转换为API需要的数字格式
 */
const getDirectionValue = (direction: Direction): number => {
  switch (direction) {
    case Direction.LEFT:
      return 0;
    case Direction.UP:
      return 1;
    case Direction.RIGHT:
      return 2;
    case Direction.DOWN:
      return 3;
    default:
      return 0;
  }
};

/**
 * 将API返回的数字方向转换为游戏中的方向枚举
 */
export const getDirectionFromValue = (value: number): Direction | null => {
  switch (value) {
    case 0:
      return Direction.LEFT;
    case 1:
      return Direction.UP;
    case 2:
      return Direction.RIGHT;
    case 3:
      return Direction.DOWN;
    case 4:
      return null; // 使用护盾
    default:
      return Direction.RIGHT; // 默认向右移动
  }
};
