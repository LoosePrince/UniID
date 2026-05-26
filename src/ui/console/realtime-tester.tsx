"use client";

import * as React from "react";
import { Radio, Send, Trash2 } from "lucide-react";
import { Button, Field, Input, Textarea, toast } from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

interface RealtimeLogEntry {
  id: string;
  label: string;
  at: number;
  data: unknown;
}

function parsePayload(source: string, t: (key: string) => string) {
  if (!source.trim()) return null;
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new Error(t("realtime.payloadInvalid"));
  }
}

function formatLogData(data: unknown) {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export function RealtimeTester({ appId }: { appId: string }) {
  const { t, formatTime } = useI18n();
  const [channel, setChannel] = React.useState("broadcast:debug");
  const [event, setEvent] = React.useState("broadcast");
  const [payload, setPayload] = React.useState('{\n  "text": "hello"\n}');
  const [connected, setConnected] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [logs, setLogs] = React.useState<RealtimeLogEntry[]>([]);
  const sourceRef = React.useRef<EventSource | null>(null);

  const statusText = connected ? t("realtime.statusConnected") : t("realtime.statusDisconnected");

  const addLog = React.useCallback((label: string, data: unknown) => {
    setLogs((prev) => [
      { id: `${Date.now()}-${Math.random()}`, label, at: Date.now(), data },
      ...prev
    ].slice(0, 50));
  }, []);

  const disconnect = React.useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setConnected(false);
  }, []);

  React.useEffect(() => disconnect, [disconnect]);

  function connect() {
    setError(null);
    disconnect();
    const target = channel.trim();
    if (!target) {
      setError(t("realtime.channelRequired"));
      return;
    }

    const url = `/api/v1/apps/${appId}/realtime/stream?channels=${encodeURIComponent(target)}`;
    const source = new EventSource(url, { withCredentials: true });
    sourceRef.current = source;

    source.addEventListener("ready", (ev) => {
      setConnected(true);
      addLog("ready", JSON.parse((ev as MessageEvent).data));
    });
    source.onmessage = (ev) => {
      setConnected(true);
      addLog("message", JSON.parse(ev.data));
    };
    source.onerror = () => {
      setConnected(false);
      setError(t("realtime.connectionFailed"));
    };
  }

  async function send() {
    setError(null);
    let data: unknown;
    try {
      data = parsePayload(payload, t);
    } catch (err) {
      setError(String((err as Error).message ?? err));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/realtime/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channel, event, payload: data })
      });
      const json = (await res.json().catch(() => ({}))) as {
        channel?: string | null;
        delivered?: number;
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(json.error?.message ?? t("http.status", { status: res.status }));
      toast.success(t("realtime.sent"), { description: `${json.channel ?? channel} · ${json.delivered ?? 0} subscriber(s)` });
      addLog("sent", json);
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("realtime.sendFailed"), { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Field htmlFor="rt-channel" label={t("realtime.channel")} required help={t("realtime.channelHelp")}>
            <Input
              id="rt-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="broadcast:debug"
            />
          </Field>
          <Field htmlFor="rt-event" label={t("realtime.eventName")} help={t("realtime.eventHelp")}>
            <Input id="rt-event" value={event} onChange={(e) => setEvent(e.target.value)} />
          </Field>
          <Field htmlFor="rt-payload" label={t("cron.payloadJson")} error={error}>
            <Textarea
              id="rt-payload"
              className="min-h-[180px] font-mono text-xs"
              spellCheck={false}
              invalid={Boolean(error)}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={connected ? "secondary" : "primary"} onClick={connect}>
              <Radio /> {connected ? t("realtime.reconnect") : t("realtime.connect")}
            </Button>
            <Button type="button" onClick={send} loading={busy} loadingText={t("common.processing")}>
              <Send /> {t("realtime.send")}
            </Button>
            <Button type="button" variant="ghost" onClick={disconnect} disabled={!connected}>
              {t("realtime.disconnect")}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-ink-100 bg-cream-50/60">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink-900">{t("realtime.logTitle")}</p>
              <p className="text-xs text-ink-500">{t("realtime.statusLabel", { status: statusText })}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setLogs([])} disabled={logs.length === 0}>
              <Trash2 /> {t("realtime.clear")}
            </Button>
          </div>
          <div className="max-h-[420px] overflow-auto p-3">
            {logs.length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-500">{t("realtime.emptyLog")}</div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-md border border-ink-100 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-ink-700">{log.label}</span>
                      <span className="text-ink-400">{formatTime(log.at)}</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-all font-mono text-2xs text-ink-700">
                      {formatLogData(log.data)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
