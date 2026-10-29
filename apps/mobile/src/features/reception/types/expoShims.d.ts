// Type declarations for Expo native modules used in reception
declare module 'expo-sqlite' {
  export interface SQLiteRunResult {
    changes: number;
    lastInsertRowId: number;
  }

  export interface SQLiteDatabase {
    execAsync(source: string): Promise<void>;
    runAsync(source: string, ...params: unknown[]): Promise<SQLiteRunResult>;
    getFirstAsync<T = unknown>(source: string, ...params: unknown[]): Promise<T | null>;
    getAllAsync<T = unknown>(source: string, ...params: unknown[]): Promise<T[]>;
    eachAsync<T = unknown>(source: string, params: unknown[], callback: (row: T) => void): Promise<void>;
    withTransactionAsync<T>(task: () => Promise<T>): Promise<T>;
    closeAsync(): Promise<void>;
  }

  export function openDatabaseAsync(databaseName: string): Promise<SQLiteDatabase>;
}

declare module 'expo-crypto' {
  export enum CryptoDigestAlgorithm {
    SHA1 = 'SHA-1',
    SHA256 = 'SHA-256',
    SHA384 = 'SHA-384',
    SHA512 = 'SHA-512',
    MD5 = 'MD5',
  }

  export enum CryptoEncoding {
    HEX = 'hex',
    BASE64 = 'base64',
  }

  export interface CryptoDigestOptions {
    encoding?: CryptoEncoding;
  }

  export function digestStringAsync(
    algorithm: CryptoDigestAlgorithm,
    data: string,
    options?: CryptoDigestOptions,
  ): Promise<string>;

  export function randomUUID(): string;
}

declare module 'expo-camera' {
  import type React from 'react';

  export interface BarcodeScanningResult {
    data: string;
    type: string;
    raw?: string;
    bounds?: unknown;
    cornerPoints?: unknown[];
  }

  export interface CameraViewProps {
    style?: unknown;
    facing?: 'front' | 'back';
    enableTorch?: boolean;
    barcodeScannerSettings?: {
      barcodeTypes?: string[];
    };
    onBarcodeScanned?: (result: BarcodeScanningResult) => void;
    children?: React.ReactNode;
  }

  export const CameraView: React.ComponentType<CameraViewProps>;

  export interface PermissionResponse {
    status: 'granted' | 'undetermined' | 'denied';
    granted: boolean;
    canAskAgain: boolean;
    expires: 'never' | number;
  }

  export function useCameraPermissions(): [
    PermissionResponse | null,
    () => Promise<PermissionResponse>,
    () => Promise<PermissionResponse>,
  ];
}
