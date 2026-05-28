"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type NavigationMode = "push" | "replace";

interface NavigationTransitionContextValue {
  isPending: boolean;
  navigate: (href: string, mode?: NavigationMode) => void;
}

const NavigationTransitionContext = React.createContext<NavigationTransitionContextValue | null>(null);

export function NavigationTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isTransitionPending, startTransition] = React.useTransition();
  const [targetHref, setTargetHref] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTargetHref(null);
  }, [pathname, searchParams]);

  const navigate = React.useCallback(
    (href: string, mode: NavigationMode = "push") => {
      setTargetHref(href);
      startTransition(() => {
        if (mode === "replace") {
          router.replace(href);
          return;
        }
        router.push(href);
      });
    },
    [router]
  );

  const value = React.useMemo(
    () => ({
      isPending: isTransitionPending || targetHref !== null,
      navigate
    }),
    [isTransitionPending, navigate, targetHref]
  );

  return (
    <NavigationTransitionContext.Provider value={value}>
      {children}
    </NavigationTransitionContext.Provider>
  );
}

export function useNavigationTransition() {
  const context = React.useContext(NavigationTransitionContext);
  if (!context) {
    throw new Error("useNavigationTransition must be used inside NavigationTransitionProvider");
  }
  return context;
}