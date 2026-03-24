// @frontier-digest/slack — barrel exports

export { postWeeklyDigest, type SlackPostResult } from "./post.js";
export { createInteractionServer } from "./server.js";
export { buildDigestBlocks } from "./blocks/digest-post.js";
export { buildExpandBlocks } from "./blocks/expand-reply.js";
export { buildSourcesBlocks } from "./blocks/sources-reply.js";
export {
  buildCompareBlocks,
  type ComparisonData,
} from "./blocks/compare-reply.js";
