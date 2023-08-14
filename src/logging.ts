/* Copyright(C) 2017-2023, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * protect-logging.ts: Logging support for the UniFi Protect library.
 */

// Logging support, borrowed from Homebridge.
export interface Logging {
    debug(message: string, ...parameters: unknown[]): void;
    error(message: string, ...parameters: unknown[]): void;
    info(message: string, ...parameters: unknown[]): void;
    warn(message: string, ...parameters: unknown[]): void;
}
