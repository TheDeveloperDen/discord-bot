// Rate limiting utility
import { logger } from "../logging.js";

export class MessageFetcher {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private readonly delay = 1000; // 1 second between fetches

  async addToQueue(fetchFunction: () => Promise<void>) {
    this.queue.push(fetchFunction);
    if (!this.processing) {
      this.processQueue().then(() =>
        logger.info("Message Fetcher Queue processed"),
      );
    }
  }

  private async processQueue() {
    this.processing = true;
    while (this.queue.length > 0) {
      const fetchFunction = this.queue.shift();
      if (fetchFunction) {
        try {
          await fetchFunction();
        } catch (error) {
          console.error("Error fetching messages:", error);
        }
        // Wait before processing next
        await new Promise((resolve) => setTimeout(resolve, this.delay));
      }
    }
    this.processing = false;
  }
}
