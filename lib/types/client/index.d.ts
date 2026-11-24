/**
 * @dsh-external/dsh-quick-commands — client half.
 *
 * Contributes the Session panel's quick-commands section: one row per shell
 * command line defined for THIS Session. The row's left area runs the command;
 * the chevron on the right expands the row, which shows the command itself
 * (with a copy button) and the latest run result.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const inject: string[];
/**
 * Register the Session panel section.
 * @param ctx - client root context carrying the slot registry.
 */
export declare function apply(ctx: Context): void;
