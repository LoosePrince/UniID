import { useCallback, useEffect, useRef, useState } from "react";
import type { FromQuery, RecordEnvelope, UniIDError } from "@uniid/sdk";

export interface UseQueryResult<T> {
  data: RecordEnvelope<T>[] | null;
  nextCursor?: string;
  error: UniIDError | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * 直接传入一个 FromQuery；hook 调用 `.run()` 并缓存结果。
 * 当 `keys` 中任一项变化时会重新执行查询。
 */
export function useQuery<T = unknown>(
  buildQuery: () => FromQuery<T>,
  keys: ReadonlyArray<unknown> = []
): UseQueryResult<T> {
  const [data, setData] = useState<RecordEnvelope<T>[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [error, setError] = useState<UniIDError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const refetch = useCallback(async () => {
    abortRef.current.cancelled = false;
    const flight = { cancelled: false };
    abortRef.current = flight;
    setIsLoading(true);
    setError(null);
    try {
      const res = await buildQuery().run();
      if (flight.cancelled) return;
      setData(res.records);
      setNextCursor(res.nextCursor);
    } catch (err) {
      if (flight.cancelled) return;
      setError(err as UniIDError);
    } finally {
      if (!flight.cancelled) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, keys);

  useEffect(() => {
    refetch();
    return () => {
      abortRef.current.cancelled = true;
    };
  }, [refetch]);

  return { data, nextCursor, error, isLoading, refetch };
}
