import type { 
  Clock, 
  Logger, 
  StateRepository, 
  UsageDataRepository, 
  NotificationService 
} from "./interfaces.ts";

import { SystemClock, MockClock } from "../infrastructure/clock.ts";
import { ConsoleLogger, MockLogger } from "../infrastructure/logger.ts";
import { FileStateRepository, MemoryStateRepository } from "../infrastructure/state-repository.ts";
import { CCUsageRepository, MockUsageRepository } from "../infrastructure/usage-repository.ts";
import { SlackNotificationService, MockNotificationService } from "../infrastructure/notification-service.ts";

export interface Dependencies {
  clock: Clock;
  logger: Logger;
  stateRepository: StateRepository;
  usageRepository: UsageDataRepository;
  notificationService: NotificationService;
}

export class DependencyContainer {
  private static instance: DependencyContainer | null = null;
  private _clock: Clock | null = null;
  private _logger: Logger | null = null;
  private _stateRepository: StateRepository | null = null;
  private _usageRepository: UsageDataRepository | null = null;
  private _notificationService: NotificationService | null = null;

  private constructor() {}

  static getInstance(): DependencyContainer {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer();
    }
    return DependencyContainer.instance;
  }

  getDependencies(useStructuredLogging: boolean = false): Dependencies {
    return {
      clock: this.getClock(),
      logger: this.getLogger(),
      stateRepository: this.getStateRepository(),
      usageRepository: this.getUsageRepository(),
      notificationService: this.getNotificationService()
    };
  }

  getClock(): Clock {
    if (!this._clock) {
      this._clock = this.isTestMode() ? new MockClock(new Date()) : new SystemClock();
    }
    return this._clock;
  }

  setClock(clock: Clock): void {
    this._clock = clock;
  }

  getLogger(): Logger {
    if (!this._logger) {
      if (this.isTestMode()) {
        this._logger = new MockLogger();
      } else {
        const useStructuredLogging = process.env.CCWATCH_STRUCTURED_LOGS === "true";
        this._logger = new ConsoleLogger(useStructuredLogging);
      }
    }
    return this._logger;
  }

  setLogger(logger: Logger): void {
    this._logger = logger;
  }

  getStateRepository(): StateRepository {
    if (!this._stateRepository) {
      if (this.isTestMode()) {
        this._stateRepository = new MemoryStateRepository();
      } else {
        this._stateRepository = new FileStateRepository(this.getLogger());
      }
    }
    return this._stateRepository;
  }

  setStateRepository(repository: StateRepository): void {
    this._stateRepository = repository;
  }

  getUsageRepository(): UsageDataRepository {
    if (!this._usageRepository) {
      if (this.isTestMode()) {
        this._usageRepository = new MockUsageRepository({ monthly: [], totals: { totalCost: 0 } });
      } else {
        this._usageRepository = new CCUsageRepository(this.getLogger());
      }
    }
    return this._usageRepository;
  }

  setUsageRepository(repository: UsageDataRepository): void {
    this._usageRepository = repository;
  }

  getNotificationService(): NotificationService {
    if (!this._notificationService) {
      if (this.isTestMode()) {
        this._notificationService = new MockNotificationService();
      } else {
        this._notificationService = new SlackNotificationService(this.getLogger());
      }
    }
    return this._notificationService;
  }

  setNotificationService(service: NotificationService): void {
    this._notificationService = service;
  }

  // テスト用: 依存関係を上書き
  setDependencies(dependencies: Dependencies): void {
    this._clock = dependencies.clock;
    this._logger = dependencies.logger;
    this._stateRepository = dependencies.stateRepository;
    this._usageRepository = dependencies.usageRepository;
    this._notificationService = dependencies.notificationService;
  }

  // テスト用: リセット
  reset(): void {
    this._clock = null;
    this._logger = null;
    this._stateRepository = null;
    this._usageRepository = null;
    this._notificationService = null;
  }

  private isTestMode(): boolean {
    return process.env.NODE_ENV === "test";
  }
}

// ファクトリー関数（後方互換性のため）
export function createDefaultDependencies(useStructuredLogging: boolean = false): Dependencies {
  return DependencyContainer.getInstance().getDependencies(useStructuredLogging);
}