import { run, RunStreamEvent } from "@openai/agents";
import type { Agent, AgentInputItem, RunToolCallItem, RunToolCallOutputItem } from "@openai/agents";

import type { DatabaseContext } from "../types/index.js";

/**
 * Generic interface for a UI adapter that receives incremental updates
 * from the AgentRunner and renders them to the user.
 */
export interface StreamUIAdapter {
  onStatus(text: string): Promise<void>;
  onToolStart(item: RunToolCallItem): Promise<void>;
  onToolResult(item: RunToolCallOutputItem): Promise<void>;
}

/**
 * Runs an agent with streaming and relays every event to the provided UI adapter.
 * Optionally handles simple auto-approval of interruptions.
 */
export class AgentRunner {
  constructor(private agent: Agent, private ui: StreamUIAdapter) { }

  async run(input: AgentInputItem[], dbCtx?: DatabaseContext, autoApprove = false) {
    let stream = await run(this.agent, input, { stream: true, context: dbCtx });
    await this.handleStream(stream);
    await stream.completed;

    // Process interruptions (HITL)
    while (stream.interruptions?.length) {
      const intr = stream.interruptions[0];
      if (!intr) break;
      await this.ui.onStatus("⚠️ Tool call requires approval.");

      if (!autoApprove) {
        // If not auto-approving, just break (caller should handle)
        return;
      }

      const state = stream.state;
      state.approve(intr as any);
      stream = await run(this.agent, state, { stream: true, context: dbCtx });
      await this.handleStream(stream);
      await stream.completed;
    }

    return stream;
  }

  private async handleStream(stream: AsyncIterable<RunStreamEvent>) {
    for await (const event of stream) {
      if (event.type !== "run_item_stream_event") {
        continue;
      }

      switch (event.item.type) {
        case "tool_call_item":
          await this.ui.onToolStart(event.item);
          break;
        case "tool_call_output_item":
          await this.ui.onToolResult(event.item);
          break;
      }
    }
  }
} 