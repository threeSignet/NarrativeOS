import { registerHandler, findHandler, listHandlers } from "./types";
import { SettingItemHandler } from "./setting-item";
import { OutlineHandler } from "./outline";
import { ScaleDesignHandler } from "./scale-design";

export type { ProposalHandler, ProposalHandlerContext, HandlerResult, NotificationOpts } from "./types";
export { registerHandler, findHandler, listHandlers } from "./types";

// Order matters: more specific handlers first, fallback last
registerHandler(new OutlineHandler());
registerHandler(new ScaleDesignHandler());
registerHandler(new SettingItemHandler()); // must be last — it's the fallback
