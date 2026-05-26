"use client";



import * as React from "react";

import { useRouter } from "next/navigation";

import { AlertTriangle, Globe2, Save, Trash2 } from "lucide-react";

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


