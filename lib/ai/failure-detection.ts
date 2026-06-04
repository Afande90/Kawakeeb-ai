/**
 * Shared failure-detection (used by Patterns 1 & 5).
 *
 * Decides whether a turn "failed" by regex on tool outputs and on the model's
 * own reply. Source: odysseus teacher_escalation.py.
 */

const TOOL_FAILURE = /^Unknown action|^Failed to|not found|^Invalid|error:/im;
const REPLY_FAILURE =
  /I don't have a tool|could you specify|unable to|I cannot|I'm not able to/i;

/** Did a tool output indicate failure? */
export function toolOutputFailed(output: string): boolean {
  return TOOL_FAILURE.test(output);
}

/** Did the model's reply indicate it got stuck / couldn't do the task? */
export function replyIndicatesFailure(reply: string): boolean {
  return REPLY_FAILURE.test(reply);
}

/** Combined check for a completed turn. */
export function turnFailed(opts: {
  reply: string;
  toolOutputs?: string[];
}): boolean {
  if (replyIndicatesFailure(opts.reply)) {
    return true;
  }
  for (const o of opts.toolOutputs ?? []) {
    if (toolOutputFailed(o)) {
      return true;
    }
  }
  return false;
}
