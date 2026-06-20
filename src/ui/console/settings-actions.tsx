"use client";



import * as React from "react";

import { useRouter } from "next/navigation";

import { AlertTriangle, CheckCircle2, Copy, Globe2, KeyRound, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";

import {

  Button,
  buttonVariants,

  Dialog,

  DialogBody,

  DialogContent,

  DialogDescription,

  DialogFooter,

  DialogHeader,

  DialogTitle,

  DialogTrigger,

  Field,

  Input,

  Textarea,

  toast,
  cn

} from "@/ui/primitives";

import { useI18n } from "@/ui/i18n";



interface ApiErrorResponse {

  error?: { message?: string };

}

interface ApiKeySummary {
  id: string;
  label: string;
  prefix: string;
  scopes: string;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
  createdBy?: { id: string; username: string } | null;
}

interface DomainSummary {
  id: string;
  host: string;
  verified: boolean;
  verifyToken: string | null;
  verification: {
    type: string;
    name: string;
    value: string;
  };
}



interface BasicInfoFormProps {

  appId: string;

  initial: { name: string; description: string | null; primaryDomain: string };

  canManageDomain: boolean;

}



interface QuotaFormProps {

  appId: string;

  quota: {

    rpsLimit: number;

    dailyApiCalls: number;

    monthlyStorageBytes: number;

    monthlyEgressBytes: number;

    fnInvocationsDaily: number;

  };

}



function apiMessage(json: ApiErrorResponse, fallback: string) {

  return json.error?.message ?? fallback;

}

async function copyText(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  toast.success(label);
}

function parseScopes(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
  } catch {}
  return [];
}

function parseScopeInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}



function toNonNegativeInt(value: string) {

  const next = Number(value);

  return Number.isFinite(next) ? Math.max(0, Math.trunc(next)) : 0;

}



function toPositiveInt(value: string) {

  return Math.max(1, toNonNegativeInt(value));

}



export function BasicInfoForm({ appId, initial, canManageDomain }: BasicInfoFormProps) {

  const { t } = useI18n();

  const router = useRouter();

  const [name, setName] = React.useState(initial.name);

  const [description, setDescription] = React.useState(initial.description ?? "");

  const [primaryDomain, setPrimaryDomain] = React.useState(initial.primaryDomain);

  const [busy, setBusy] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);



  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault();

    setBusy(true);

    setError(null);

    try {

      const res = await fetch(`/api/v1/apps/${appId}/settings`, {

        method: "PATCH",

        headers: { "Content-Type": "application/json" },

        credentials: "include",

        body: JSON.stringify({

          name: name.trim(),

          description: description.trim() || undefined,

          ...(canManageDomain ? { primaryDomain: primaryDomain.trim() } : {})

        })

      });

      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;

      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));

      toast.success(t("settings.basicSaved"), { description: name.trim() });

      router.refresh();

    } catch (err) {

      const message = String((err as Error).message ?? err);

      setError(message);

      toast.error(t("common.saveFailed"), { description: message });

    } finally {

      setBusy(false);

    }

  }



  return (

    <form onSubmit={onSubmit} className="space-y-4">

      <Field htmlFor="app-name" label={t("settings.appName")} required>

        <Input

          id="app-name"

          required

          maxLength={64}

          value={name}

          onChange={(event) => setName(event.target.value)}

          disabled={busy}

        />

      </Field>

      <Field htmlFor="app-desc" label={t("common.description")} help={t("settings.appDescHelp")}>

        <Textarea

          id="app-desc"

          className="min-h-24"

          maxLength={500}

          value={description}

          onChange={(event) => setDescription(event.target.value)}

          disabled={busy}

        />

      </Field>

      <Field

        htmlFor="app-domain"

        label={t("settings.primaryDomain")}

        required

        error={error}

        help={canManageDomain ? t("settings.domainHelpAdmin") : t("settings.domainHelpReadonly")}

      >

        <Input

          id="app-domain"

          required

          value={primaryDomain}

          onChange={(event) => setPrimaryDomain(event.target.value)}

          disabled={busy || !canManageDomain}

          invalid={Boolean(error)}

          placeholder="example.com"

        />

      </Field>

      <Button type="submit" loading={busy} loadingText={t("common.saving")} disabled={!name.trim() || !primaryDomain.trim()}>

        <Save /> {t("common.save")}

      </Button>

    </form>

  );

}



export function QuotaForm({ appId, quota }: QuotaFormProps) {

  const { t } = useI18n();

  const router = useRouter();

  const [busy, setBusy] = React.useState(false);

  const [form, setForm] = React.useState(quota);

  const [error, setError] = React.useState<string | null>(null);



  function set<K extends keyof typeof form>(key: K, value: number) {

    setForm((prev) => ({ ...prev, [key]: value }));

  }



  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault();

    setBusy(true);

    setError(null);

    try {

      const res = await fetch(`/api/v1/apps/${appId}/settings`, {

        method: "PATCH",

        headers: { "Content-Type": "application/json" },

        credentials: "include",

        body: JSON.stringify({ quota: form })

      });

      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;

      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));

      toast.success(t("settings.quotaSaved"));

      router.refresh();

    } catch (err) {

      const message = String((err as Error).message ?? err);

      setError(message);

      toast.error(t("common.saveFailed"), { description: message });

    } finally {

      setBusy(false);

    }

  }



  return (

    <form onSubmit={onSubmit} className="space-y-4">

      <QuotaField label={t("settings.quotaRps")} htmlFor="quota-rps">

        <Input

          id="quota-rps"

          type="number"

          min={1}

          value={form.rpsLimit}

          onChange={(event) => set("rpsLimit", toPositiveInt(event.target.value))}

          disabled={busy}

        />

      </QuotaField>

      <QuotaField label={t("settings.quotaDailyApi")} htmlFor="quota-daily-api">

        <Input

          id="quota-daily-api"

          type="number"

          min={1}

          value={form.dailyApiCalls}

          onChange={(event) => set("dailyApiCalls", toPositiveInt(event.target.value))}

          disabled={busy}

        />

      </QuotaField>

      <QuotaField label={t("settings.quotaStorage")} htmlFor="quota-storage">

        <Input

          id="quota-storage"

          type="number"

          min={0}

          value={form.monthlyStorageBytes}

          onChange={(event) => set("monthlyStorageBytes", toNonNegativeInt(event.target.value))}

          disabled={busy}

        />

      </QuotaField>

      <QuotaField label={t("settings.quotaEgress")} htmlFor="quota-egress">

        <Input

          id="quota-egress"

          type="number"

          min={0}

          value={form.monthlyEgressBytes}

          onChange={(event) => set("monthlyEgressBytes", toNonNegativeInt(event.target.value))}

          disabled={busy}

        />

      </QuotaField>

      <QuotaField label={t("settings.quotaFnDaily")} htmlFor="quota-fn">

        <Input

          id="quota-fn"

          type="number"

          min={0}

          value={form.fnInvocationsDaily}

          onChange={(event) => set("fnInvocationsDaily", toNonNegativeInt(event.target.value))}

          disabled={busy}

        />

      </QuotaField>

      {error ? (

        <p className="text-xs leading-5 text-danger-700" role="alert">

          {error}

        </p>

      ) : null}

      <Button type="submit" loading={busy} loadingText={t("common.saving")}>

        <Save /> {t("settings.saveQuota")}

      </Button>

    </form>

  );

}

export function ApiKeysPanel({ appId, keys }: { appId: string; keys: ApiKeySummary[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [label, setLabel] = React.useState("");
  const [scopes, setScopes] = React.useState("*");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    setBusy("create");
    setError(null);
    setSecret(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label: trimmed, scopes: parseScopeInput(scopes) })
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse & { secret?: string };
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      setLabel("");
      setScopes("*");
      setSecret(json.secret ?? null);
      toast.success(t("settings.apiKeyCreated"), { description: trimmed });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.createFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function revokeKey(key: ApiKeySummary) {
    setBusy(`revoke:${key.id}`);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/api-keys/${key.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      toast.success(t("settings.apiKeyRevoked"), { description: key.label });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.operationFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function rotateKey(key: ApiKeySummary) {
    setBusy(`rotate:${key.id}`);
    setError(null);
    setSecret(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/api-keys/${key.id}/rotate`, {
        method: "POST",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse & { secret?: string };
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      setSecret(json.secret ?? null);
      toast.success(t("settings.apiKeyRotated"), { description: key.label });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.operationFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={createKey} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
        <Field htmlFor="api-key-label" label={t("settings.apiKeyLabel")} error={error ?? undefined}>
          <Input
            id="api-key-label"
            maxLength={80}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            disabled={busy !== null}
            placeholder="CI import"
          />
        </Field>
        <Field htmlFor="api-key-scopes" label={t("settings.apiKeyScopes")} help={t("settings.apiKeyScopesHelp")}>
          <Input
            id="api-key-scopes"
            value={scopes}
            onChange={(event) => setScopes(event.target.value)}
            disabled={busy !== null}
            placeholder="*"
          />
        </Field>
        <Button type="submit" className="sm:mt-5" loading={busy === "create"} loadingText={t("common.creating")} disabled={!label.trim()}>
          <KeyRound /> {t("settings.createApiKey")}
        </Button>
      </form>

      {secret ? (
        <div className="rounded-md border border-success-500/30 bg-success-50/70 p-3 text-sm dark:bg-success-700/20">
          <div className="mb-2 flex items-center gap-2 font-medium text-success-700 dark:text-success-100">
            <CheckCircle2 className="h-4 w-4" /> {t("settings.apiKeySecretTitle")}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-md bg-white/70 px-3 py-2 text-xs text-ink-800 dark:bg-slate-900/60 dark:text-slate-100">
              {secret}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={() => copyText(secret, t("settings.copied"))}>
              <Copy /> {t("settings.copy")}
            </Button>
          </div>
          <p className="mt-2 text-xs text-success-700/90 dark:text-success-100/80">{t("settings.apiKeySecretHelp")}</p>
        </div>
      ) : null}

      {keys.length === 0 ? (
        <p className="text-sm text-ink-500 dark:text-slate-400">{t("settings.apiKeysEmpty")}</p>
      ) : (
        <div className="divide-y divide-ink-100 rounded-md border border-ink-100 dark:divide-slate-700 dark:border-slate-700">
          {keys.map((key) => {
            const keyScopes = parseScopes(key.scopes);
            const revoked = key.revokedAt != null;
            return (
              <div key={key.id} className="grid gap-3 p-3 text-sm lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink-900 dark:text-slate-100">{key.label}</span>
                    <span className="font-mono text-xs text-ink-500">{key.prefix}</span>
                    <span className={revoked ? "text-xs text-danger-700" : "text-xs text-success-700"}>
                      {revoked ? t("settings.apiKeyRevokedStatus") : t("common.active")}
                    </span>
                  </div>
                  <p className="truncate text-xs text-ink-500 dark:text-slate-400">
                    {t("settings.apiKeyMeta", {
                      scopes: keyScopes.length ? keyScopes.join(", ") : "—",
                      lastUsed: key.lastUsedAt ? new Date(key.lastUsedAt * 1000).toLocaleString() : t("settings.neverUsed")
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => rotateKey(key)} loading={busy === `rotate:${key.id}`}>
                    <RotateCcw /> {t("settings.rotateApiKey")}
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => revokeKey(key)} loading={busy === `revoke:${key.id}`} disabled={revoked}>
                    <Trash2 /> {t("settings.revokeApiKey")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}



function QuotaField({

  label,

  htmlFor,

  children

}: {

  label: string;

  htmlFor: string;

  children: React.ReactNode;

}) {

  return (

    <Field htmlFor={htmlFor} label={label} className="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center sm:space-y-0">

      {children}

    </Field>

  );

}



export function DangerZone({ appId, appName }: { appId: string; appName: string }) {

  const { t } = useI18n();

  const router = useRouter();

  const [confirm, setConfirm] = React.useState("");

  const [busy, setBusy] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);



  async function onDestroy() {

    if (confirm !== appName) return;

    setBusy(true);

    setError(null);

    try {

      const res = await fetch(`/api/v1/apps/${appId}/settings`, {

        method: "DELETE",

        credentials: "include"

      });

      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;

      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));

      toast.success(t("settings.appDeleted"), { description: appName });

      router.push("/console/apps");

      router.refresh();

    } catch (err) {

      const message = String((err as Error).message ?? err);

      setError(message);

      toast.error(t("common.deleteFailed"), { description: message });

    } finally {

      setBusy(false);

    }

  }



  return (

    <div className="rounded-md border border-danger-200 bg-danger-50/60 p-4 space-y-4 dark:border-danger-500/30 dark:bg-danger-500/10">

      <div className="flex gap-3">

        <AlertTriangle className="mt-0.5 h-4 w-4 text-danger-600" />

        <div>

          <h3 className="font-medium text-danger-900 text-sm dark:text-danger-100">{t("settings.deleteAppTitle")}</h3>

          <p className="text-xs leading-5 text-danger-700 mt-1 dark:text-danger-200/90">

            {t("settings.deleteAppWarning")}

          </p>

        </div>

      </div>

      <Field htmlFor="confirm-name" label={t("settings.deleteAppConfirmLabel")} error={error}>

        <Input

          id="confirm-name"

          value={confirm}

          onChange={(event) => setConfirm(event.target.value)}

          placeholder={appName}

          disabled={busy}

          invalid={Boolean(error)}

        />

      </Field>

      <Button type="button" variant="danger" onClick={onDestroy} loading={busy} loadingText={t("common.deleting")} disabled={confirm !== appName}>

        <Trash2 /> {t("settings.deleteAppPermanent")}

      </Button>

    </div>

  );

}



export function AddDomainForm({ appId, disabled = false }: { appId: string; disabled?: boolean }) {

  const { t } = useI18n();

  const router = useRouter();

  const [host, setHost] = React.useState("");

  const [busy, setBusy] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);



  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (disabled) return;

    const normalizedHost = host.trim();

    if (!normalizedHost) return;



    setBusy(true);

    setError(null);

    try {

      const res = await fetch(`/api/v1/apps/${appId}/domains`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        credentials: "include",

        body: JSON.stringify({ host: normalizedHost })

      });

      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;

      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));

      setHost("");

      toast.success(t("settings.domainAdded"), { description: normalizedHost });

      router.refresh();

    } catch (err) {

      const message = String((err as Error).message ?? err);

      setError(message);

      toast.error(t("common.addFailed"), { description: message });

    } finally {

      setBusy(false);

    }

  }



  return (

    <form onSubmit={onSubmit} className="space-y-3 sm:flex sm:items-start sm:gap-2 sm:space-y-0">

      <Field htmlFor="domain-host" label={t("settings.addDomain")} error={error} className="flex-1">

        <Input

          id="domain-host"

          required

          placeholder="example.com"

          value={host}

          onChange={(event) => setHost(event.target.value)}

          disabled={busy || disabled}

          invalid={Boolean(error)}

        />

      </Field>

      <Button type="submit" className="sm:mt-5" loading={busy} loadingText={t("common.adding")} disabled={disabled || !host.trim()}>

        <Globe2 /> {disabled ? t("settings.addDomainAdminOnly") : t("common.add")}

      </Button>

    </form>

  );

}



export function RemoveDomainButton({

  appId,

  domainId,

  host,

  disabled = false

}: {

  appId: string;

  domainId: string;

  host?: string;

  disabled?: boolean;

}) {

  const { t } = useI18n();

  const router = useRouter();

  const [open, setOpen] = React.useState(false);

  const [busy, setBusy] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);

  const label = host ?? domainId;



  async function removeDomain() {

    if (disabled) return;

    setBusy(true);

    setError(null);

    try {

      const res = await fetch(`/api/v1/apps/${appId}/domains/${domainId}`, {

        method: "DELETE",

        credentials: "include"

      });

      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;

      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));

      toast.success(t("settings.domainRemoved"), { description: label });

      setOpen(false);

      router.refresh();

    } catch (err) {

      const message = String((err as Error).message ?? err);

      setError(message);

      toast.error(t("common.removeFailed"), { description: message });

    } finally {

      setBusy(false);

    }

  }



  return (

    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>

      <DialogTrigger
        type="button"
        disabled={disabled}
        title={disabled ? t("settings.removeDomainAdminOnly") : undefined}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        {t("common.remove")}
      </DialogTrigger>

      <DialogContent>

        <DialogHeader>

          <DialogTitle>{t("settings.removeDomainTitle")}</DialogTitle>

          <DialogDescription>{t("settings.removeDomainDescription")}</DialogDescription>

        </DialogHeader>

        <DialogBody className="space-y-3">

          <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-xs text-danger-700">

            {t("common.confirmRemove", { label })}

          </div>

          {error ? (

            <p className="text-xs leading-5 text-danger-700" role="alert">

              {error}

            </p>

          ) : null}

        </DialogBody>

        <DialogFooter>

          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>

            {t("common.cancel")}

          </Button>

          <Button variant="danger" onClick={removeDomain} loading={busy} loadingText={t("common.removing")}>

            <Trash2 /> {t("common.confirmAction", { action: t("common.remove") })}

          </Button>

        </DialogFooter>

      </DialogContent>

    </Dialog>

  );

}

export function DomainVerificationActions({
  appId,
  domain,
  canManualVerify = false
}: {
  appId: string;
  domain: DomainSummary;
  canManualVerify?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState<"verify" | "manual" | "token" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function post(path: string, body?: Record<string, unknown>) {
    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined
    });
    const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
    if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
  }

  async function verify(manual: boolean) {
    setBusy(manual ? "manual" : "verify");
    setError(null);
    try {
      await post(`/api/v1/apps/${appId}/domains/${domain.id}/verify`, { manual });
      toast.success(t(manual ? "settings.domainManualVerified" : "settings.domainVerified"), {
        description: domain.host
      });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.operationFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function rotateToken() {
    setBusy("token");
    setError(null);
    try {
      await post(`/api/v1/apps/${appId}/domains/${domain.id}/token`);
      toast.success(t("settings.domainTokenRotated"), { description: domain.host });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.operationFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-ink-100 bg-cream-50/60 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="grid gap-2 text-xs sm:grid-cols-[88px_1fr_auto] sm:items-center">
        <span className="font-medium text-ink-500 dark:text-slate-400">{domain.verification.type}</span>
        <code className="min-w-0 break-all rounded bg-white/70 px-2 py-1 text-ink-700 dark:bg-slate-800/70 dark:text-slate-100">
          {domain.verification.name}
        </code>
        <Button type="button" variant="ghost" size="xs" onClick={() => copyText(domain.verification.name, t("settings.copied"))}>
          <Copy /> {t("settings.copy")}
        </Button>
      </div>
      <div className="grid gap-2 text-xs sm:grid-cols-[88px_1fr_auto] sm:items-center">
        <span className="font-medium text-ink-500 dark:text-slate-400">{t("settings.domainTxtValue")}</span>
        <code className="min-w-0 break-all rounded bg-white/70 px-2 py-1 text-ink-700 dark:bg-slate-800/70 dark:text-slate-100">
          {domain.verification.value}
        </code>
        <Button type="button" variant="ghost" size="xs" onClick={() => copyText(domain.verification.value, t("settings.copied"))}>
          <Copy /> {t("settings.copy")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => verify(false)} loading={busy === "verify"} disabled={domain.verified}>
          <CheckCircle2 /> {t("settings.verifyDomain")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={rotateToken} loading={busy === "token"}>
          <RefreshCw /> {t("settings.rotateDomainToken")}
        </Button>
        {canManualVerify ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => verify(true)} loading={busy === "manual"} disabled={domain.verified}>
            <CheckCircle2 /> {t("settings.manualVerifyDomain")}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs leading-5 text-danger-700">{error}</p> : null}
    </div>
  );
}


