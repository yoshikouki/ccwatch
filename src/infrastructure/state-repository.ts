import { join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { StateRepository, DaemonState, Logger } from "../core/interfaces.ts";

export class FileStateRepository implements StateRepository {
  constructor(
    private logger: Logger,
    private stateFilePath?: string
  ) {}

  async load(): Promise<DaemonState> {
    const stateFile = this.getStateFilePath();
    
    if (!existsSync(stateFile)) {
      return {};
    }

    try {
      const data = readFileSync(stateFile, 'utf8');
      return JSON.parse(data) as DaemonState;
    } catch (error) {
      this.logger.error(`状態ファイル読み込みエラー: ${error}`, { 
        component: 'state-manager',
        filePath: stateFile
      });
      return {};
    }
  }

  async save(state: DaemonState): Promise<void> {
    const stateFile = this.getStateFilePath();
    
    try {
      writeFileSync(stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      this.logger.error(`状態ファイル保存エラー: ${error}`, { 
        component: 'state-manager',
        filePath: stateFile
      });
    }
  }

  private getStateFilePath(): string {
    if (this.stateFilePath) {
      return this.stateFilePath;
    }
    
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    return join(homeDir, '.ccwatch-state.json');
  }
}

// テスト用のメモリ実装
export class MemoryStateRepository implements StateRepository {
  private state: DaemonState = {};

  async load(): Promise<DaemonState> {
    return { ...this.state };
  }

  async save(state: DaemonState): Promise<void> {
    this.state = { ...state };
  }

  clear(): void {
    this.state = {};
  }
}