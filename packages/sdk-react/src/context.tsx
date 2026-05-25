import { createContext, useContext, type ReactNode } from "react";
import { UniID } from "@uniid/sdk";

const UniIDContext = createContext<UniID | null>(null);

export interface UniIDProviderProps {
  client: UniID;
  children: ReactNode;
}

export function UniIDProvider({ client, children }: UniIDProviderProps) {
  return <UniIDContext.Provider value={client}>{children}</UniIDContext.Provider>;
}

export function useUniIDClient(): UniID {
  const ctx = useContext(UniIDContext);
  if (!ctx) throw new Error("useUniIDClient must be used inside <UniIDProvider>");
  return ctx;
}
