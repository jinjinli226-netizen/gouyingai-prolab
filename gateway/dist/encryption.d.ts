export declare function gatewayEncryptionKey(): Buffer;
export declare function encryptSecret(plaintext: string): string;
export declare function decryptSecret(value: string): string;
export declare function isEncryptedSecret(value: string): boolean;
export declare function maskSecret(value: string): string;
