import { createContext, useContext, type PropsWithChildren } from 'react';
import type { BrowserEclipseSdkMode, EclipseSdk } from '@eclipse/sdk';

/**
 * Everything the app needs to talk to Eclipse: the composed ports, which mode
 * they were wired for, and the metadata pages render alongside them. Built once
 * by `createWebRuntime()` (production) or `createFakeRuntime()` (tests) and
 * handed down through `EclipseRuntimeProvider` — no module-level singleton.
 */
export interface EclipseRuntime {
  sdk: EclipseSdk;
  mode: BrowserEclipseSdkMode;
  contractAddress: string;
  explorerUrl: string;
  debug: boolean;
}

const EclipseRuntimeContext = createContext<EclipseRuntime | null>(null);

export function EclipseRuntimeProvider({
  runtime,
  children,
}: PropsWithChildren<{ runtime: EclipseRuntime }>) {
  return (
    <EclipseRuntimeContext.Provider value={runtime}>{children}</EclipseRuntimeContext.Provider>
  );
}

export function useEclipseRuntime(): EclipseRuntime {
  const runtime = useContext(EclipseRuntimeContext);
  if (!runtime) throw new Error('useEclipseRuntime requires EclipseRuntimeProvider');
  return runtime;
}
