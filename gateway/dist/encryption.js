import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
const ALGORITHM = "aes-256-gcm";
export function gatewayEncryptionKey() {
    const hex = process.env.GATEWAY_ENCRYPTION_KEY || "";
    const key = Buffer.from(hex, "hex");
    if (key.length !== 32) {
        throw new Error("GATEWAY_ENCRYPTION_KEY 必须是 64 位十六进制字符（32 字节）");
    }
    return key;
}
export function encryptSecret(plaintext) {
    const key = gatewayEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}
export function decryptSecret(value) {
    const key = gatewayEncryptionKey();
    const parts = value.split(".");
    if (parts.length !== 4 || parts[0] !== "v1")
        throw new Error("无法解密渠道密钥：格式不正确");
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(parts[1], "base64"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64"));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64")), decipher.final()]).toString("utf8");
}
export function isEncryptedSecret(value) {
    return value.startsWith("v1.");
}
export function maskSecret(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return "";
    if (isEncryptedSecret(trimmed)) {
        try {
            return `****${decryptSecret(trimmed).slice(-4)}`;
        }
        catch {
            return "****";
        }
    }
    return trimmed.length <= 4 ? "****" : `****${trimmed.slice(-4)}`;
}
//# sourceMappingURL=encryption.js.map