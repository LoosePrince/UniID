"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Save, ShieldCheck, Database, Radio, FolderArchive, Cloud, Globe2, Gauge, Mail } from "lucide-react";
import { Button, Field, Input, Switch, Textarea, toast } from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";
import type { SystemConfig } from "@/shared/system-config";

interface QuotaDefaults {
  rpsLimit: number;
  dailyApiCalls: number;
  monthlyStorageBytes: number;
  fnInvocationsDaily: number;
}

interface AuthSecurityConfig {
  emailVerificationEnabled: boolean;
  twoFactorEnabled: boolean;
}

type NumericKey = {
  [K in keyof SystemConfig]: SystemConfig[K] extends number ? K : never;
}[keyof SystemConfig];

type BooleanKey = {
  [K in keyof SystemConfig]: SystemConfig[K] extends boolean ? K : never;
}[keyof SystemConfig];

type StringKey = {
  [K in keyof SystemConfig]: SystemConfig[K] extends string ? K : never;
}[keyof SystemConfig];

export function SystemConfigForm({ initial }: { initial: SystemConfig }) {
  const { t } = useI18n();
  const [form, setForm] = useState<SystemConfig>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const setString = (key: StringKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const setNumber = (key: NumericKey, value: string) => {
    const next = Number(value);
    if (Number.isFinite(next)) {
      setForm((current) => ({ ...current, [key]: next }));
      setError(null);
    }
  };

  const setBoolean = (key: BooleanKey, value: boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const setList = (key: "adminAllowedOrigins" | "fnFetchWhitelist", value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)
    }));
    setError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/admin/config/system", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error?.message ?? t("http.status", { status: res.status }));
        }
        toast.success(t("admin.config.systemSaved"));
      } catch (err) {
        const message = err instanceof Error ? err.message : t("common.saveFailed");
        setError(message);
        toast.error(t("common.saveFailed"), { description: message });
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <ConfigSection icon={<ShieldCheck />} title={t("admin.config.authSecurityTitle")}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ToggleField
            id="email-verification-enabled"
            title={t("admin.config.emailVerificationLabel")}
            description={t("admin.config.emailVerificationHelp")}
            checked={form.emailVerificationEnabled}
            disabled={pending}
            onCheckedChange={(checked) => setBoolean("emailVerificationEnabled", checked)}
          />
          <ToggleField
            id="two-factor-enabled"
            title={t("admin.config.twoFactorLabel")}
            description={t("admin.config.twoFactorHelp")}
            checked={form.twoFactorEnabled}
            disabled={pending}
            onCheckedChange={(checked) => setBoolean("twoFactorEnabled", checked)}
          />
        </div>
      </ConfigSection>

      <ConfigSection icon={<Mail />} title={t("admin.config.smtpTitle")}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ToggleField
            id="smtp-enabled"
            title={t("admin.config.smtpEnabledLabel")}
            description={t("admin.config.smtpEnabledHelp")}
            checked={form.smtpEnabled}
            disabled={pending}
            onCheckedChange={(checked) => setBoolean("smtpEnabled", checked)}
          />
          <ToggleField
            id="smtp-secure"
            title={t("admin.config.smtpSecureLabel")}
            description={t("admin.config.smtpSecureHelp")}
            checked={form.smtpSecure}
            disabled={pending}
            onCheckedChange={(checked) => setBoolean("smtpSecure", checked)}
          />
          <Field label={t("admin.config.smtpHostLabel")} htmlFor="smtp-host">
            <Input id="smtp-host" value={form.smtpHost} onChange={(event) => setString("smtpHost", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.smtpPortLabel")} htmlFor="smtp-port">
            <Input id="smtp-port" type="number" min={1} max={65535} value={form.smtpPort} onChange={(event) => setNumber("smtpPort", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.smtpUserLabel")} htmlFor="smtp-user">
            <Input id="smtp-user" value={form.smtpUser} onChange={(event) => setString("smtpUser", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.smtpPasswordLabel")} htmlFor="smtp-password">
            <Input id="smtp-password" type="password" value={form.smtpPassword} onChange={(event) => setString("smtpPassword", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.smtpFromLabel")} htmlFor="smtp-from">
            <Input id="smtp-from" value={form.smtpFrom} onChange={(event) => setString("smtpFrom", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.smtpReplyToLabel")} htmlFor="smtp-reply-to">
            <Input id="smtp-reply-to" value={form.smtpReplyTo} onChange={(event) => setString("smtpReplyTo", event.target.value)} disabled={pending} />
          </Field>
        </div>
      </ConfigSection>

      <ConfigSection icon={<Globe2 />} title={t("admin.config.publicCorsTitle")}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("admin.config.publicUrlLabel")} htmlFor="public-url">
            <Input id="public-url" value={form.publicUrl} onChange={(event) => setString("publicUrl", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.adminOriginsLabel")} htmlFor="admin-origins" help={t("admin.config.listHelp")}>
            <Textarea
              id="admin-origins"
              className="min-h-24"
              value={form.adminAllowedOrigins.join("\n")}
              onChange={(event) => setList("adminAllowedOrigins", event.target.value)}
              disabled={pending}
            />
          </Field>
        </div>
      </ConfigSection>

      <ConfigSection icon={<ShieldCheck />} title={t("admin.config.passwordHashTitle")}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label={t("admin.config.argon2TimeLabel")} htmlFor="argon2-time">
            <Input id="argon2-time" type="number" min={1} value={form.argon2TimeCost} onChange={(event) => setNumber("argon2TimeCost", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.argon2MemoryLabel")} htmlFor="argon2-memory">
            <Input id="argon2-memory" type="number" min={1024} value={form.argon2MemoryKb} onChange={(event) => setNumber("argon2MemoryKb", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.argon2ParallelismLabel")} htmlFor="argon2-parallelism">
            <Input id="argon2-parallelism" type="number" min={1} value={form.argon2Parallelism} onChange={(event) => setNumber("argon2Parallelism", event.target.value)} disabled={pending} />
          </Field>
        </div>
      </ConfigSection>

      <ConfigSection icon={<FolderArchive />} title={t("admin.config.filesTitle")}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ToggleField
            id="files-enabled"
            title={t("admin.config.filesEnabledLabel")}
            description={t("admin.config.filesEnabledHelp")}
            checked={form.filesEnabled}
            disabled={pending}
            onCheckedChange={(checked) => setBoolean("filesEnabled", checked)}
          />
          <ToggleField
            id="s3-path-style"
            title={t("admin.config.s3PathStyleLabel")}
            description={t("admin.config.s3PathStyleHelp")}
            checked={form.s3ForcePathStyle}
            disabled={pending}
            onCheckedChange={(checked) => setBoolean("s3ForcePathStyle", checked)}
          />
          <Field label={t("admin.config.s3InternalLabel")} htmlFor="s3-internal">
            <Input id="s3-internal" value={form.s3EndpointInternal} onChange={(event) => setString("s3EndpointInternal", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.s3ExternalLabel")} htmlFor="s3-external">
            <Input id="s3-external" value={form.s3EndpointExternal} onChange={(event) => setString("s3EndpointExternal", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.s3RegionLabel")} htmlFor="s3-region">
            <Input id="s3-region" value={form.s3Region} onChange={(event) => setString("s3Region", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.s3BucketLabel")} htmlFor="s3-bucket">
            <Input id="s3-bucket" value={form.s3Bucket} onChange={(event) => setString("s3Bucket", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.s3AccessKeyLabel")} htmlFor="s3-access-key">
            <Input id="s3-access-key" value={form.s3AccessKey} onChange={(event) => setString("s3AccessKey", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.s3SecretKeyLabel")} htmlFor="s3-secret-key">
            <Input id="s3-secret-key" type="password" value={form.s3SecretKey} onChange={(event) => setString("s3SecretKey", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.fileMaxSizeLabel")} htmlFor="file-max-size">
            <Input id="file-max-size" type="number" min={1} value={form.fileMaxSizeBytes} onChange={(event) => setNumber("fileMaxSizeBytes", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.filePresignTtlLabel")} htmlFor="file-presign-ttl">
            <Input id="file-presign-ttl" type="number" min={1} value={form.filePresignTtlSeconds} onChange={(event) => setNumber("filePresignTtlSeconds", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.fileShareTtlLabel")} htmlFor="file-share-ttl">
            <Input id="file-share-ttl" type="number" min={1} value={form.fileShareTokenTtlSeconds} onChange={(event) => setNumber("fileShareTokenTtlSeconds", event.target.value)} disabled={pending} />
          </Field>
        </div>
      </ConfigSection>

      <ConfigSection icon={<Cloud />} title={t("admin.config.functionsTitle")}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ToggleField
            id="functions-enabled"
            title={t("admin.config.functionsEnabledLabel")}
            description={t("admin.config.functionsEnabledHelp")}
            checked={form.functionsEnabled}
            disabled={pending}
            onCheckedChange={(checked) => setBoolean("functionsEnabled", checked)}
          />
          <Field label={t("admin.config.fnWhitelistLabel")} htmlFor="fn-whitelist" help={t("admin.config.listHelp")}>
            <Textarea
              id="fn-whitelist"
              className="min-h-24"
              value={form.fnFetchWhitelist.join("\n")}
              onChange={(event) => setList("fnFetchWhitelist", event.target.value)}
              disabled={pending}
            />
          </Field>
          <Field label={t("admin.config.fnMemoryLabel")} htmlFor="fn-memory">
            <Input id="fn-memory" type="number" min={1} value={form.fnDefaultMemoryMb} onChange={(event) => setNumber("fnDefaultMemoryMb", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.fnTimeoutLabel")} htmlFor="fn-timeout">
            <Input id="fn-timeout" type="number" min={1} value={form.fnDefaultTimeoutMs} onChange={(event) => setNumber("fnDefaultTimeoutMs", event.target.value)} disabled={pending} />
          </Field>
        </div>
      </ConfigSection>

      <ConfigSection icon={<Radio />} title={t("admin.config.realtimeTitle")}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ToggleField
            id="realtime-enabled"
            title={t("admin.config.realtimeEnabledLabel")}
            description={t("admin.config.realtimeEnabledHelp")}
            checked={form.realtimeEnabled}
            disabled={pending}
            onCheckedChange={(checked) => setBoolean("realtimeEnabled", checked)}
          />
          <Field label={t("admin.config.realtimeKeepaliveLabel")} htmlFor="realtime-keepalive">
            <Input id="realtime-keepalive" type="number" min={1} value={form.realtimeKeepaliveSeconds} onChange={(event) => setNumber("realtimeKeepaliveSeconds", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.realtimeReplayLabel")} htmlFor="realtime-replay">
            <Input id="realtime-replay" type="number" min={1} value={form.realtimeReplayWindowSeconds} onChange={(event) => setNumber("realtimeReplayWindowSeconds", event.target.value)} disabled={pending} />
          </Field>
        </div>
      </ConfigSection>

      <ConfigSection icon={<Database />} title={t("admin.config.databaseTitle")}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label={t("admin.config.databasesDirLabel")} htmlFor="databases-dir" help={t("admin.config.databasesDirHelp")}>
            <Input id="databases-dir" value={form.uniidDatabasesDir} onChange={(event) => setString("uniidDatabasesDir", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.defaultMainRecordLabel")} htmlFor="main-record-limit">
            <Input id="main-record-limit" type="number" min={1} value={form.defaultMainRecordLimit} onChange={(event) => setNumber("defaultMainRecordLimit", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.defaultMainStorageLabel")} htmlFor="main-storage-limit">
            <Input id="main-storage-limit" type="number" min={1} value={form.defaultMainStorageBytes} onChange={(event) => setNumber("defaultMainStorageBytes", event.target.value)} disabled={pending} />
          </Field>
        </div>
      </ConfigSection>

      <ConfigSection icon={<Gauge />} title={t("admin.config.defaultQuotaTitle")}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label={t("admin.config.rpsLabel")} htmlFor="quota-rps" help={t("admin.config.rpsHelp")}>
            <Input id="quota-rps" type="number" min={1} value={form.quotaRpsDefault} onChange={(event) => setNumber("quotaRpsDefault", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.dailyApiLabel")} htmlFor="quota-daily">
            <Input id="quota-daily" type="number" min={1} value={form.quotaDailyApiDefault} onChange={(event) => setNumber("quotaDailyApiDefault", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.storageLabel")} htmlFor="quota-storage">
            <Input id="quota-storage" type="number" min={1} value={form.quotaMonthlyStorageBytesDefault} onChange={(event) => setNumber("quotaMonthlyStorageBytesDefault", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.egressLabel")} htmlFor="quota-egress">
            <Input id="quota-egress" type="number" min={1} value={form.quotaMonthlyEgressBytesDefault} onChange={(event) => setNumber("quotaMonthlyEgressBytesDefault", event.target.value)} disabled={pending} />
          </Field>
          <Field label={t("admin.config.fnDailyLabel")} htmlFor="quota-fn">
            <Input id="quota-fn" type="number" min={1} value={form.quotaFnInvocationsDailyDefault} onChange={(event) => setNumber("quotaFnInvocationsDailyDefault", event.target.value)} disabled={pending} />
          </Field>
        </div>
      </ConfigSection>

      {error ? (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-100" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} loadingText={t("common.saving")} disabled={!dirty}>
          <Save /> {t("admin.config.saveSystem")}
        </Button>
        {!dirty ? <span className="text-xs text-ink-400 dark:text-slate-500">{t("profile.noChanges")}</span> : null}
      </div>
    </form>
  );
}

export function DefaultQuotaForm({ initial }: { initial: QuotaDefaults }) {
  return (
    <SystemConfigForm
      initial={{
        ...defaultCompatSystemConfig(),
        quotaRpsDefault: initial.rpsLimit,
        quotaDailyApiDefault: initial.dailyApiCalls,
        quotaMonthlyStorageBytesDefault: initial.monthlyStorageBytes,
        quotaFnInvocationsDailyDefault: initial.fnInvocationsDaily
      }}
    />
  );
}

export function AuthSecurityForm({ initial }: { initial: AuthSecurityConfig }) {
  return (
    <SystemConfigForm
      initial={{
        ...defaultCompatSystemConfig(),
        emailVerificationEnabled: initial.emailVerificationEnabled,
        twoFactorEnabled: initial.twoFactorEnabled
      }}
    />
  );
}

function ConfigSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-ink-100 pt-5 first:border-t-0 first:pt-0 dark:border-slate-700/70">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-slate-100">
        <span className="[&>svg]:size-4 [&>svg]:text-accent-600 dark:[&>svg]:text-accent-300">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function ToggleField({
  id,
  title,
  description,
  checked,
  disabled,
  onCheckedChange
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-28 items-start justify-between gap-4 rounded-md border border-ink-100 bg-cream-50 px-4 py-3 dark:border-slate-700/70 dark:bg-slate-900/50">
      <div className="min-w-0 space-y-1">
        <label htmlFor={id} className="block text-sm font-medium text-ink-900 dark:text-slate-100">
          {title}
        </label>
        <p className="text-xs leading-5 text-ink-500 dark:text-slate-400">{description}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}

function defaultCompatSystemConfig(): SystemConfig {
  return {
    publicUrl: "http://localhost:3000",
    adminAllowedOrigins: ["http://localhost:3000"],
    argon2TimeCost: 3,
    argon2MemoryKb: 65_536,
    argon2Parallelism: 1,
    emailVerificationEnabled: true,
    twoFactorEnabled: true,
    smtpEnabled: false,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPassword: "",
    smtpFrom: "",
    smtpReplyTo: "",
    filesEnabled: true,
    s3EndpointInternal: "",
    s3EndpointExternal: "",
    s3Region: "us-east-1",
    s3Bucket: "",
    s3AccessKey: "",
    s3SecretKey: "",
    s3ForcePathStyle: true,
    fileMaxSizeBytes: 104_857_600,
    filePresignTtlSeconds: 300,
    fileShareTokenTtlSeconds: 604_800,
    functionsEnabled: true,
    fnDefaultMemoryMb: 64,
    fnDefaultTimeoutMs: 5_000,
    fnFetchWhitelist: [],
    realtimeEnabled: true,
    realtimeKeepaliveSeconds: 25,
    realtimeReplayWindowSeconds: 60,
    uniidDatabasesDir: "./data/app-databases",
    defaultMainRecordLimit: 1_000,
    defaultMainStorageBytes: 5_242_880,
    quotaRpsDefault: 60,
    quotaDailyApiDefault: 1_000_000,
    quotaMonthlyStorageBytesDefault: 10_737_418_240,
    quotaMonthlyEgressBytesDefault: 53_687_091_200,
    quotaFnInvocationsDailyDefault: 100_000
  };
}
