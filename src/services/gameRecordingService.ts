import { GameRecording, GameRecordingFrame, SerializedSafeZone } from "../types/GameRecording";
import { GameState } from "../types/GameState";
import { Player } from "../types/User";

// IndexedDB database name and store name
const DB_NAME = "SnakeGameDB";
const STORE_NAME = "gameRecordings";
const DB_VERSION = 1;

/**
 * Service for recording, storing, and retrieving game recordings
 */
export class GameRecordingService {
  private db: IDBDatabase | null = null;
  private recording: GameRecording | null = null;
  private isRecording: boolean = false;

  /**
   * Initialize the IndexedDB database
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error("Error opening IndexedDB:", event);
        reject(new Error("Failed to open IndexedDB"));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log("IndexedDB initialized successfully");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for game recordings if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
          console.log("Created game recordings store");
        }
      };
    });
  }

  /**
   * Start recording a new game session
   */
  startRecording(
    players: Player[],
    totalTicks: number,
    initialGameState?: GameState,
  ): void {
    if (this.isRecording) {
      console.warn("Already recording a game session");
      return;
    }

    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const name = `Game ${new Date(timestamp).toLocaleString()}`;

    this.recording = {
      id,
      timestamp,
      name,
      players,
      frames: [],
      totalTicks,
      finalScores: []
    };

    // 如果提供了初始游戏状态，将其作为第0帧记录
    if (initialGameState) {
      try {
        // 创建一个深拷贝以避免引用问题
        const stateCopy: any = {
          entities: {
            snakes: initialGameState.entities.snakes.map(snake => this.sanitizeObject(snake.serialize())),
            foodItems: initialGameState.entities.foodItems.map(food => this.sanitizeObject(food.serialize())),
            obstacles: initialGameState.entities.obstacles.map(obstacle => this.sanitizeObject(obstacle.serialize())),
            treasureChests: initialGameState.entities.treasureChests?.map(chest => this.sanitizeObject(chest.serialize())) || [],
            keys: initialGameState.entities.keys?.map(key => this.sanitizeObject(key.serialize())) || []
          },
          vortexField: this.sanitizeObject(initialGameState.vortexField || {
            stateCode: 0,
            param1: 0,
            param2: 0,
            param3: 0,
            param4: 0,
            param5: 0
          }),
          safeZone: initialGameState.safeZone ? this.sanitizeObject(initialGameState.safeZone) : undefined
        };

        this.recording.initialFrame = {
          tick: 0,
          gameState: stateCopy
        };
        console.log("Recorded initial game state");
      } catch (error) {
        console.error("Error recording initial frame:", error);
      }
    }

    this.isRecording = true;
    console.log("Started recording game session:", id);
  }

  /**
   * Record a single frame (tick) of the game
   */
  recordFrame(
    tick: number,
    gameState: GameState,
    safeZone?: SerializedSafeZone
  ): void {
    if (!this.isRecording || !this.recording) {
      console.warn("Not currently recording");
      return;
    }

    try {
      // Create a deep copy of the game state to avoid reference issues
      const stateCopy = {
        entities: {
          snakes: gameState.entities.snakes.map(snake => this.sanitizeObject(snake.serialize())),
          foodItems: gameState.entities.foodItems.map(food => this.sanitizeObject(food.serialize())),
          obstacles: gameState.entities.obstacles.map(obstacle => this.sanitizeObject(obstacle.serialize())),
          treasureChests: gameState.entities.treasureChests?.map(chest => this.sanitizeObject(chest.serialize())) || [],
          keys: gameState.entities.keys?.map(key => this.sanitizeObject(key.serialize())) || []
        },
        vortexField: this.sanitizeObject(gameState.vortexField),
        safeZone,
      };

      const frame: GameRecordingFrame = {
        tick,
        gameState: stateCopy
      };

      this.recording.frames.push(frame);
    } catch (error) {
      console.error("Error recording frame:", error);
    }
  }

  /**
   * Sanitizes an object to ensure it's serializable
   */
  private sanitizeObject(obj: any): any {
    try {
      // 使用 JSON 序列化和反序列化来移除不可序列化的属性
      return JSON.parse(JSON.stringify(obj));
    } catch (error) {
      console.warn("Failed to sanitize object, returning empty object:", error);
      return {}; // 返回空对象作为后备
    }
  }

  /**
   * 设置录制的最终得分，但不保存
   */
  setFinalScores(finalScores: any[]): void {
    if (!this.isRecording || !this.recording) {
      console.warn("Not currently recording");
      return;
    }

    try {
      // 清理最终得分数据
      this.recording.finalScores = this.sanitizeObject(finalScores);
      console.log("Final scores set for recording");
    } catch (error) {
      console.error("Failed to set final scores:", error);
    }
  }

  /**
   * 保存当前录制
   */
  async saveCurrentRecording(): Promise<string | null> {
    if (!this.isRecording || !this.recording || !this.db) {
      console.warn("Not currently recording or DB not initialized");
      return null;
    }

    try {
      const recordingId = this.recording.id;
      await this.saveRecording(this.recording);
      this.isRecording = false;
      this.recording = null;
      return recordingId;
    } catch (error) {
      console.error("Failed to save recording:", error);
      return null;
    }
  }

  /**
   * 丢弃当前录制
   */
  discardCurrentRecording(): void {
    if (!this.isRecording || !this.recording) {
      console.warn("Not currently recording");
      return;
    }

    this.isRecording = false;
    this.recording = null;
    console.log("Recording discarded");
  }

  /**
   * Stop recording and save the game session (旧方法，保留向后兼容)
   */
  async stopRecording(finalScores: any[]): Promise<string | null> {
    if (!this.isRecording || !this.recording || !this.db) {
      console.warn("Not currently recording or DB not initialized");
      return null;
    }

    try {
      // 清理最终得分数据
      this.recording.finalScores = this.sanitizeObject(finalScores);
      this.isRecording = false;

      const recordingId = this.recording.id;
      await this.saveRecording(this.recording);
      this.recording = null;
      return recordingId;
    } catch (error) {
      console.error("Failed to save recording:", error);
      this.isRecording = false;
      this.recording = null;
      return null;
    }
  }

  /**
   * Save a game recording to IndexedDB
   */
  private saveRecording(recording: GameRecording): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      try {
        // 创建一个可序列化的副本
        const cleanRecording = this.createSerializableCopy(recording);

        const transaction = this.db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(cleanRecording);

        request.onsuccess = () => {
          console.log("Game recording saved successfully:", recording.id);
          resolve();
        };

        request.onerror = (event) => {
          console.error("Error saving game recording:", event);
          reject(new Error("Failed to save game recording"));
        };
      } catch (error) {
        console.error("Error preparing recording for save:", error);
        reject(error);
      }
    });
  }

  /**
   * Creates a serializable copy of the recording by removing any non-serializable properties
   */
  private createSerializableCopy(recording: GameRecording): GameRecording {
    // 使用 JSON 序列化和反序列化来创建深拷贝并移除不可序列化的属性
    try {
      // 先尝试直接序列化整个对象
      return JSON.parse(JSON.stringify(recording));
    } catch (error) {
      console.warn("Failed to directly serialize recording, trying manual approach:", error);

      // 如果直接序列化失败，尝试手动构建一个新的对象
      const cleanRecording: GameRecording = {
        id: recording.id,
        timestamp: recording.timestamp,
        name: recording.name,
        players: this.cleanPlayers(recording.players),
        frames: this.cleanFrames(recording.frames),
        totalTicks: recording.totalTicks,
        finalScores: this.cleanScores(recording.finalScores)
      };

      return cleanRecording;
    }
  }

  /**
   * Cleans player data to ensure it's serializable
   */
  private cleanPlayers(players: Player[]): Player[] {
    return players.map(player => ({
      userId: player.userId,
      username: player.username,
      nickname: player.nickname,
      avatarId: player.avatarId,
      intro: player.intro || ""
    }));
  }

  /**
   * Cleans frames data to ensure it's serializable
   */
  private cleanFrames(frames: GameRecordingFrame[]): GameRecordingFrame[] {
    return frames.map(frame => ({
      tick: frame.tick,
      gameState: {
        entities: {
          snakes: frame.gameState.entities.snakes,
          foodItems: frame.gameState.entities.foodItems,
          obstacles: frame.gameState.entities.obstacles,
          ...(frame.gameState.entities.treasureChests && { treasureChests: frame.gameState.entities.treasureChests }),
          ...(frame.gameState.entities.keys && { keys: frame.gameState.entities.keys }),
        },
        vortexField: frame.gameState.vortexField,
        ...(frame.gameState.safeZone && { safeZone: frame.gameState.safeZone })
      }
    }));
  }

  /**
   * Cleans final scores data to ensure it's serializable
   */
  private cleanScores(scores: any[]): any[] {
    return scores.map(score => ({
      name: score.name || "",
      username: score.username || "",
      score: score.score || 0,
      isAlive: !!score.isAlive
    }));
  }

  /**
   * Get all saved game recordings
   */
  async getAllRecordings(): Promise<GameRecording[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("timestamp");
      const request = index.openCursor(null, "prev"); // Sort by timestamp descending

      const recordings: GameRecording[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          recordings.push(cursor.value);
          cursor.continue();
        } else {
          resolve(recordings);
        }
      };

      request.onerror = (event) => {
        console.error("Error getting game recordings:", event);
        reject(new Error("Failed to get game recordings"));
      };
    });
  }

  /**
   * Get a specific game recording by ID
   */
  async getRecordingById(id: string): Promise<GameRecording | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = (event) => {
        console.error("Error getting game recording:", event);
        reject(new Error("Failed to get game recording"));
      };
    });
  }

  /**
   * Delete a game recording by ID
   */
  async deleteRecording(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log("Game recording deleted successfully:", id);
        resolve();
      };

      request.onerror = (event) => {
        console.error("Error deleting game recording:", event);
        reject(new Error("Failed to delete game recording"));
      };
    });
  }

  /**
   * Update a game recording's name
   */
  async updateRecordingName(id: string, name: string): Promise<void> {
    try {
      const recording = await this.getRecordingById(id);
      if (!recording) {
        throw new Error("Recording not found");
      }

      recording.name = name;
      await this.saveRecording(recording);
    } catch (error) {
      console.error("Error updating recording name:", error);
      throw error;
    }
  }

  /**
   * Export a game recording as a JSON file
   */
  exportRecording(id: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const recording = await this.getRecordingById(id);
        if (!recording) {
          throw new Error("Recording not found");
        }

        const json = JSON.stringify(recording);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `snake-game-recording-${recording.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        resolve();
      } catch (error) {
        console.error("Error exporting recording:", error);
        reject(error);
      }
    });
  }

  /**
   * Import a game recording from a JSON file
   */
  importRecording(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const json = event.target?.result as string;
          const recording = JSON.parse(json) as GameRecording;

          // Generate a new ID to avoid conflicts
          recording.id = crypto.randomUUID();
          recording.timestamp = Date.now();

          await this.saveRecording(recording);
          resolve(recording.id);
        } catch (error) {
          console.error("Error importing recording:", error);
          reject(error);
        }
      };

      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        reject(error);
      };

      reader.readAsText(file);
    });
  }
}

// Create and export a singleton instance
export const gameRecordingService = new GameRecordingService();
