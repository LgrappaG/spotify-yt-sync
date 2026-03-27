import cron from 'node-cron';
import { getLogger } from './logger.js';

/**
 * Scheduler for managing cron jobs
 */
export class Scheduler {
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private logger = getLogger();

  /**
   * Schedules a task with a cron expression
   */
  schedule(
    taskName: string,
    cronExpression: string,
    callback: () => Promise<void> | void
  ): cron.ScheduledTask {
    try {
      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }

      // Create and store task
      const task = cron.schedule(cronExpression, async () => {
        try {
          this.logger.info(`Executing scheduled task: ${taskName}`);
          await Promise.resolve(callback());
          this.logger.info(`Scheduled task completed: ${taskName}`);
        } catch (error) {
          this.logger.error(`Scheduled task failed: ${taskName}`, error);
        }
      });

      this.tasks.set(taskName, task);
      this.logger.info(`Scheduled task registered: ${taskName}`, {
        cronExpression,
      });

      return task;
    } catch (error) {
      this.logger.error(
        `Failed to schedule task: ${taskName}`,
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  /**
   * Stops a scheduled task
   */
  stop(taskName: string): boolean {
    const task = this.tasks.get(taskName);
    if (!task) {
      this.logger.warn(`Task not found: ${taskName}`);
      return false;
    }

    try {
      task.stop();
      task.destroy();
      this.tasks.delete(taskName);
      this.logger.info(`Task stopped: ${taskName}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to stop task: ${taskName}`,
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }

  /**
   * Stops all scheduled tasks
   */
  stopAll(): void {
    try {
      for (const [taskName] of this.tasks) {
        this.stop(taskName);
      }
      this.logger.info('All scheduled tasks stopped');
    } catch (error) {
      this.logger.error(
        'Failed to stop all tasks',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Gets all scheduled tasks
   */
  getTasks(): Map<string, cron.ScheduledTask> {
    return this.tasks;
  }

  /**
   * Checks if a task is scheduled
   */
  isScheduled(taskName: string): boolean {
    return this.tasks.has(taskName);
  }

  /**
   * Gets the next execution time for a task (approximate)
   */
  getNextExecution(cronExpression: string): Date | null {
    try {
      const task = cron.schedule(cronExpression, () => {});
      const nextDate = new Date();

      // Simple approximation - a full implementation would need cron-parser
      // For now, just return next minute
      nextDate.setSeconds(0);
      nextDate.setMilliseconds(0);
      nextDate.setMinutes(nextDate.getMinutes() + 1);

      task.stop();
      task.destroy();

      return nextDate;
    } catch (error) {
      this.logger.error(
        'Failed to calculate next execution',
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }
}

// Singleton instance
let schedulerInstance: Scheduler | null = null;

/**
 * Gets the scheduler instance
 */
export function getScheduler(): Scheduler {
  if (!schedulerInstance) {
    schedulerInstance = new Scheduler();
  }
  return schedulerInstance;
}

/**
 * Creates a new scheduler instance
 */
export function createScheduler(): Scheduler {
  return new Scheduler();
}
