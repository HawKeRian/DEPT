export type EncryptedEnvelope = {
  encryptedPayload: string;
  wrappedKey: string;
  salt: string;
  wrapIv: string;
  dataIv: string;
  cryptoVersion: 1;
  updatedAt: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DATA_CONTEXT = encoder.encode("tanglak-finance-v1");
const KEY_CONTEXT = encoder.encode("tanglak-key-v1");
const PBKDF2_ITERATIONS = 600_000;

function toBase64(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function deriveWrappingKey(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function createEncryptedEnvelope(data: unknown, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const dataKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const rawDataKey = await crypto.subtle.exportKey("raw", dataKey);
  const runtimeDataKey = await crypto.subtle.importKey("raw", rawDataKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const wrappingKey = await deriveWrappingKey(passphrase, salt);
  const wrappedKey = await crypto.subtle.encrypt({ name: "AES-GCM", iv: wrapIv, additionalData: KEY_CONTEXT }, wrappingKey, rawDataKey);
  const envelope = await encryptWithDataKey(data, runtimeDataKey, {
    wrappedKey: toBase64(wrappedKey),
    salt: toBase64(salt),
    wrapIv: toBase64(wrapIv),
  });
  return { envelope, dataKey: runtimeDataKey };
}

export async function unlockEnvelope<T>(envelope: EncryptedEnvelope, passphrase: string) {
  const wrappingKey = await deriveWrappingKey(passphrase, fromBase64(envelope.salt));
  const rawDataKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(envelope.wrapIv), additionalData: KEY_CONTEXT },
    wrappingKey,
    fromBase64(envelope.wrappedKey),
  );
  const dataKey = await crypto.subtle.importKey("raw", rawDataKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(envelope.dataIv), additionalData: DATA_CONTEXT },
    dataKey,
    fromBase64(envelope.encryptedPayload),
  );
  return { data: JSON.parse(decoder.decode(plaintext)) as T, dataKey };
}

export async function encryptWithDataKey(
  data: unknown,
  dataKey: CryptoKey,
  keyInfo: Pick<EncryptedEnvelope, "wrappedKey" | "salt" | "wrapIv">,
): Promise<EncryptedEnvelope> {
  const dataIv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(data));
  const encryptedPayload = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: dataIv, additionalData: DATA_CONTEXT },
    dataKey,
    plaintext,
  );
  return {
    ...keyInfo,
    encryptedPayload: toBase64(encryptedPayload),
    dataIv: toBase64(dataIv),
    cryptoVersion: 1,
    updatedAt: new Date().toISOString(),
  };
}
