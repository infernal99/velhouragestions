"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { runAction } from "@/components/forms/use-action-form";
import { deleteCategory, saveCategory } from "@/lib/actions/settings";
import type { ExpenseCategory } from "@/types/database";

function Row({ category }: { category: ExpenseCategory }) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const dirty = name !== category.name || color !== category.color;
  return (
    <li className="flex items-center gap-2">
      <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer p-1" aria-label="Color" />
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 flex-1" />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Guardar"
        disabled={!dirty || !name.trim()}
        onClick={async () => {
          const res = await runAction(saveCategory(category.id, { name, color }));
          if (res.ok) router.refresh();
        }}
      >
        <Check />
      </Button>
      <ConfirmDialog
        title={`¿Eliminar «${category.name}»?`}
        description="Los gastos de esta categoría se conservarán sin categoría."
        onConfirm={async () => {
          const res = await runAction(deleteCategory(category.id));
          if (res.ok) router.refresh();
        }}
        trigger={(o) => (
          <Button variant="ghost" size="icon-sm" aria-label="Eliminar" onClick={o} className="hover:text-destructive">
            <Trash2 />
          </Button>
        )}
      />
    </li>
  );
}

export function CategoriesForm({ categories }: { categories: ExpenseCategory[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#64748b");
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {categories.map((c) => (
          <Row key={c.id} category={c} />
        ))}
      </ul>
      <form
        className="flex items-center gap-2 border-t pt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await runAction(saveCategory(null, { name, color }));
          if (res.ok) {
            setName("");
            router.refresh();
          }
        }}
      >
        <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer p-1" aria-label="Color" />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva categoría" className="h-8 flex-1" />
        <Button type="submit" size="sm" variant="outline" disabled={!name.trim()}>
          <Plus /> Añadir
        </Button>
      </form>
    </div>
  );
}
