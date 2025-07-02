import { 
  Clock, 
  Logger, 
  StateRepository, 
  UsageDataRepository, 
  NotificationService 
} from "./interfaces.ts";

import { SystemClock } from "../infrastructure/clock.ts";
import { ConsoleLogger } from "../infrastructure/logger.ts";
import { FileStateRepository } from "../infrastructure/state-repository.ts";
import { CCUsageRepository } from "../infrastructure/usage-repository.ts";
import { SlackNotificationService } from "../infrastructure/notification-service.ts";

export interface Dependencies {
  clock: Clock;
  logger: Logger;
  stateRepository: StateRepository;
  usageRepository: UsageDataRepository;
  notificationService: NotificationService;
}

export class DependencyContainer {
  private static instance: DependencyContainer | null = null;
  private dependencies: Dependencies | null = null;

  private constructor() {}

  static getInstance(): DependencyContainer {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer();
    }
    return DependencyContainer.instance;
  }

  getDependencies(useStructuredLogging: boolean = false): Dependencies {
    if (!this.dependencies) {
      this.dependencies = this.createDependencies(useStructuredLogging);
    }
    return this.dependencies;
  }

  // テスト用: 依存関係を上書き
  setDependencies(dependencies: Dependencies): void {
    this.dependencies = dependencies;
  }

  // テスト用: リセット
  reset(): void {
    this.dependencies = null;
    DependencyContainer.instance = null;
  }

  private createDependencies(useStructuredLogging: boolean): Dependencies {
    const logger = new ConsoleLogger(useStructuredLogging);
    const clock = new SystemClock();
    const stateRepository = new FileStateRepository(logger);
    const usageRepository = new CCUsageRepository(logger);
    const notificationService = new SlackNotificationService(logger);

    return {
      clock,
      logger,
      stateRepository,
      usageRepository,
      notificationService
    };
  }
}

// ファクトリー関数（後方互換性のため）
export function createDefaultDependencies(useStructuredLogging: boolean = false): Dependencies {
  return DependencyContainer.getInstance().getDependencies(useStructuredLogging);
}