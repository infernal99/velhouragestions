"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useApp, useMemberName } from "@/components/app-provider";
import { runAction } from "@/components/forms/use-action-form";
import { addComment, deleteComment } from "@/lib/actions/tasks";
import { formatRelative, formatDateTime } from "@/lib/format";

export interface CommentItem {
  id: string;
  body: string;
  author_id: string | null;
  created_at: string;
}

export function Comments({
  target,
  comments,
  onChanged,
}: {
  target: { project_id?: string; task_id?: string; client_id?: string };
  comments: CommentItem[];
  /** For panels that hold their own copy of the list (task sheet). */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const { userId, permissions, team } = useApp();
  const memberName = useMemberName();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  const refresh = () => (onChanged ? onChanged() : router.refresh());

  const submit = () =>
    start(async () => {
      if (!body.trim()) return;
      const res = await runAction(addComment({ ...target, body }));
      if (res.ok) {
        setBody("");
        refresh();
      }
    });

  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="size-4" /> Sin comentarios todavía.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => {
            const author = team.find((t) => t.id === c.author_id);
            const canDelete = c.author_id === userId || permissions.isAdmin;
            return (
              <li key={c.id} className="group flex gap-3">
                <UserAvatar name={memberName(c.author_id)} src={author?.avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{memberName(c.author_id) ?? "Usuario eliminado"}</span>
                    <span className="text-xs text-muted-foreground" title={formatDateTime(c.created_at)}>
                      {formatRelative(c.created_at)}
                    </span>
                    {canDelete ? (
                      <ConfirmDialog
                        title="¿Eliminar comentario?"
                        onConfirm={async () => {
                          const res = await runAction(deleteComment(c.id));
                          if (res.ok) refresh();
                        }}
                        trigger={(open) => (
                          <button
                            type="button"
                            onClick={open}
                            className="ml-auto text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                            aria-label="Eliminar comentario"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      />
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-col gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe un comentario interno…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Ctrl + Enter para enviar</span>
          <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Comentar
          </Button>
        </div>
      </div>
    </div>
  );
}
