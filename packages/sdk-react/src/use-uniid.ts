import { useCallback, useEffect, useState } from "react";
import type { AuthorizeOptions, UniIDUser } from "@uniid/sdk";
import { useUniIDClient } from "./context";

export function useUniID() {
  const client = useUniIDClient();
  const [user, setUser] = useState<UniIDUser | null>(client.auth.user);

  useEffect(() => {
    const off = client.auth.onChange(setUser);
    return off;
  }, [client]);

  const login = useCallback((opts?: AuthorizeOptions) => client.auth.login(opts), [client]);
  const logout = useCallback(() => client.auth.logout(), [client]);
  const refresh = useCallback(() => client.auth.refresh(), [client]);
  const check = useCallback(() => client.auth.check(), [client]);

  return {
    client,
    user,
    isAuthenticated: user !== null,
    login,
    logout,
    refresh,
    check
  };
}
