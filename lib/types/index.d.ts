/**
 * @dsh-external/dsh-quick-commands — host half.
 *
 * Owns the quick-command definitions the agent writes through the
 * `quick_commands` tool and serves them to the browser half at
 * `GET /quick-commands/api`. The Session panel section renders one button per
 * definition: a named shell command line, shown when the row expands and
 * copied on demand.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "@dsh-external/dsh-quick-commands";
export declare const inject: string[];
/** Plugin configuration. */
export interface Config {
    /** Store path; empty uses `$DSH_HOME/quick-commands.json`. */
    storeFile: string;
    /**
     * Sandbox mode for one-click runs. The Session panel runs a command without
     * an Agent turn, so no permission preset applies; this deployment choice
     * decides the confinement. `danger-full-access` matches a profile whose
     * default preset is unconfined.
     */
    sandboxMode: 'read-only' | 'workspace-write' | 'danger-full-access';
}
/** Schemastery configuration for the store location and run confinement. */
export declare const Config: z<Config>;
/**
 * Register the `quick_commands` tool and the read route.
 * @param ctx - registrant context carrying the tool registry and web server.
 * @param config - store location.
 */
export declare function apply(ctx: Context, config: Config): void;
