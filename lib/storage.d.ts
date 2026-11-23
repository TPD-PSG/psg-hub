export function storageEnabled(): boolean;
export function saveFile(area: string, filename: string, buffer: Buffer | ArrayBuffer | Uint8Array, mime?: string | null): Promise<{ key: string | null; base64: string | null }>;
export function loadFile(key: string | null | undefined, base64: string | null | undefined): Promise<Buffer<ArrayBuffer> | null>;
export function loadBase64(key: string | null | undefined, base64: string | null | undefined): Promise<string | null>;
export function removeFile(key: string | null | undefined): Promise<void>;
export function putObject(key: string, buffer: Buffer, mime?: string | null): Promise<void>;
export function makeKey(area: string, filename: string): string;
export function objectSize(key: string): Promise<number>;
