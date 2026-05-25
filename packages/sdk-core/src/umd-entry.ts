/**
 * UMD 单入口：避免多命名导出导致全局变为 `{ UniID, default, policy }` 对象。
 */
import { UniID } from "./index";

export default UniID;
