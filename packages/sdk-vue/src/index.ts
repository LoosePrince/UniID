/**
 * Vue 3 composables for the UniID SDK.
 */
import { inject, onScopeDispose, ref, shallowRef, type App, type InjectionKey, type Ref } from "vue";
import type {
  AuthorizeOptions,
  FromQuery,
  RealtimeChannel,
  RecordEnvelope,
  UniIDError,
  UniIDUser,
  UniID
} from "@uniid/sdk";

const KEY: InjectionKey<UniID> = Symbol("uniid");

export function provideUniID(app: App, client: UniID) {
  app.provide(KEY, client);
}

export function useUniIDClient(): UniID {
  const client = inject(KEY);
  if (!client) throw new Error("provideUniID(app, client) must be called before useUniIDClient()");
  return client;
}

export function useUniID() {
  const client = useUniIDClient();
  const user: Ref<UniIDUser | null> = ref(client.auth.user);
  const off = client.auth.onChange((u) => {
    user.value = u;
  });
  onScopeDispose(() => off());

  return {
    client,
    user,
    isAuthenticated: () => user.value !== null,
    login: (opts?: AuthorizeOptions) => client.auth.login(opts),
    logout: () => client.auth.logout(),
    refresh: () => client.auth.refresh(),
    check: () => client.auth.check()
  };
}

export interface UseUniIDQueryResult<T> {
  data: Ref<RecordEnvelope<T>[] | null>;
  nextCursor: Ref<string | undefined>;
  error: Ref<UniIDError | null>;
  isLoading: Ref<boolean>;
  refetch: () => Promise<void>;
}

export function useUniIDQuery<T = unknown>(buildQuery: () => FromQuery<T>): UseUniIDQueryResult<T> {
  const data = shallowRef<RecordEnvelope<T>[] | null>(null);
  const nextCursor = ref<string | undefined>(undefined);
  const error = ref<UniIDError | null>(null);
  const isLoading = ref(false);
  let cancelled = false;

  const refetch = async () => {
    cancelled = false;
    isLoading.value = true;
    error.value = null;
    try {
      const r = await buildQuery().run();
      if (cancelled) return;
      data.value = r.records;
      nextCursor.value = r.nextCursor;
    } catch (err) {
      if (cancelled) return;
      error.value = err as UniIDError;
    } finally {
      if (!cancelled) isLoading.value = false;
    }
  };

  refetch();
  onScopeDispose(() => {
    cancelled = true;
  });

  return { data, nextCursor, error, isLoading, refetch };
}

export function useSubscription<T = unknown>(
  buildChannel: () => RealtimeChannel,
  events: ReadonlyArray<"insert" | "update" | "delete" | "broadcast" | "presence"> = ["insert", "update", "delete"]
) {
  const list = ref<T[]>([]) as { value: T[] };
  const channel = buildChannel();
  for (const ev of events) {
    channel.on(ev, (payload) => {
      list.value = [...list.value, payload as T];
    });
  }
  channel.subscribe().catch(() => {});
  onScopeDispose(() => channel.unsubscribe());

  return { events: list };
}
