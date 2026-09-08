import type { CorsOptions } from "cors";
import type { ErrorRequestHandler } from "express";
export declare function gatewayCorsOptions(environment?: NodeJS.ProcessEnv, allowLoopback?: boolean): CorsOptions;
export declare const gatewayCorsErrorHandler: ErrorRequestHandler;
export declare function isAllowedGatewayOrigin(origin: string, allowedOrigins: ReadonlySet<string>, allowLoopback: boolean): boolean;
