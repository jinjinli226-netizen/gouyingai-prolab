import { isEncryptedSecret } from "./encryption.js";
import { LocalStore } from "./local-store.js";
export declare function createLocalGatewayApp(store: LocalStore): import("express-serve-static-core").Express;
export { isEncryptedSecret };
