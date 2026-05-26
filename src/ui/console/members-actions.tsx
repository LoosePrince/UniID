"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus } from "lucide-react";
import {
  Button,
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
  toast
} from "@/ui/primitives";

interface ApiErrorResponse {
  error?: { message?: string };
}

function apiMessage(json: ApiErrorResponse, fallback: string) {
  return json.error?.message ?? fallback;
}

export function AddMemberForm({ appId }: { appId: string }) {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUsername = username.trim();
    if (!normalizedUsername) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: normalizedUsername })
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      setUsername("");
      toast.success("成员已添加", { description: normalizedUsername });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("添加失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field
        htmlFor="member-username"
        label="UniID 用户名"
        required
        error={error}
        help="被添加的成员拥有该应用的管理员权限（除删除应用外的全部操作）。"
      >
        <Input
          id="member-username"
          required
          placeholder="alice"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={busy}
          invalid={Boolean(error)}
        />
      </Field>
      <Button type="submit" loading={busy} loadingText="添加中…" disabled={!username.trim()}>
        <UserPlus /> 添加成员
      </Button>
    </form>
  );
}

export function RemoveMemberButton({
  appId,
  userId,
  username
}: {
  appId: string;
  userId: string;
  username?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const label = username ? `@${username}` : userId;

  async function removeMember() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/members/${userId}`, {
        method: "DELETE",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("成员已移除", { description: label });
      setOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("移除失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          移除
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>移除成员</DialogTitle>
          <DialogDescription>成员被移除后，将无法继续访问此应用控制台。</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-100">
            确认移除 <span className="font-mono">{label}</span>？
          </div>
          {error ? (
            <p className="text-xs leading-5 text-danger-700 dark:text-danger-200" role="alert">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            取消
          </Button>
          <Button variant="danger" onClick={removeMember} loading={busy} loadingText="移除中…">
            <Trash2 /> 确认移除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}