"use client";

import * as React from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

const NONE = "__none__";

function getError(form: UseFormReturn<FieldValues> | undefined, name: string) {
  if (!form) return undefined;
  const parts = name.split(".");
  let node: unknown = form.formState.errors;
  for (const p of parts) node = (node as Record<string, unknown> | undefined)?.[p];
  return (node as { message?: string } | undefined)?.message;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground/80">
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

// Loosely typed on purpose: RHF form types are invariant in their value types,
// so a precise generic here makes every typed form unassignable.
type FormProp<T extends FieldValues> = { form: object; _values?: T };

function asAny(form: object) {
  return form as unknown as UseFormReturn<FieldValues>;
}

export function TextField<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  required,
  className,
  ...inputProps
}: FormProp<T> & {
  name: FieldPath<T> | string;
  label?: string;
  hint?: string;
  required?: boolean;
  className?: string;
} & Omit<React.ComponentProps<typeof Input>, "name" | "form">) {
  const f = asAny(form);
  const error = getError(f, name);
  return (
    <FormField label={label} htmlFor={name} error={error} hint={hint} required={required} className={className}>
      <Input id={name} aria-invalid={Boolean(error)} {...inputProps} {...f.register(name)} />
    </FormField>
  );
}

export function TextareaField<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  required,
  className,
  ...props
}: FormProp<T> & {
  name: FieldPath<T> | string;
  label?: string;
  hint?: string;
  required?: boolean;
  className?: string;
} & Omit<React.ComponentProps<typeof Textarea>, "name" | "form">) {
  const f = asAny(form);
  const error = getError(f, name);
  return (
    <FormField label={label} htmlFor={name} error={error} hint={hint} required={required} className={className}>
      <Textarea id={name} aria-invalid={Boolean(error)} {...props} {...f.register(name)} />
    </FormField>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

/** Plain select (Base UI). Shows the option label, never the raw value. */
export function SimpleSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar…",
  allowEmpty,
  emptyLabel = "Sin asignar",
  id,
  invalid,
  className,
  disabled,
}: {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  id?: string;
  invalid?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const current = value ?? (allowEmpty ? NONE : "");
  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(v === NONE || v === null ? null : String(v))}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-invalid={invalid} className={cn("w-full", className)}>
        <SelectValue>
          {(v: string) =>
            v === NONE ? (
              <span className="text-muted-foreground">{emptyLabel}</span>
            ) : (
              (options.find((o) => o.value === v)?.label ?? <span className="text-muted-foreground">{placeholder}</span>)
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowEmpty ? <SelectItem value={NONE}>{emptyLabel}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SelectField<T extends FieldValues>({
  form,
  name,
  label,
  options,
  hint,
  required,
  allowEmpty,
  emptyLabel,
  placeholder,
  className,
}: FormProp<T> & {
  name: FieldPath<T> | string;
  label?: string;
  options: SelectOption[];
  hint?: string;
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const f = asAny(form);
  const error = getError(f, name);
  return (
    <FormField label={label} htmlFor={name} error={error} hint={hint} required={required} className={className}>
      <Controller
        control={f.control as Control<FieldValues>}
        name={name}
        render={({ field }) => (
          <SimpleSelect
            id={name}
            value={(field.value as string | null) ?? null}
            onChange={(v) => field.onChange(v ?? (allowEmpty ? null : ""))}
            options={options}
            allowEmpty={allowEmpty}
            emptyLabel={emptyLabel}
            placeholder={placeholder}
            invalid={Boolean(error)}
          />
        )}
      />
    </FormField>
  );
}

export function CheckboxField<T extends FieldValues>({
  form,
  name,
  label,
  hint,
}: FormProp<T> & { name: string; label: string; hint?: string }) {
  const f = asAny(form);
  return (
    <Controller
      control={f.control as Control<FieldValues>}
      name={name}
      render={({ field }) => (
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <Checkbox checked={Boolean(field.value)} onCheckedChange={(c) => field.onChange(Boolean(c))} className="mt-0.5" />
          <span className="grid gap-0.5">
            <span>{label}</span>
            {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
          </span>
        </label>
      )}
    />
  );
}

export interface PersonOption {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

/** Multi-select of team members (collaborators, attendees). */
export function PeoplePicker({
  people,
  value,
  onChange,
  placeholder = "Añadir personas",
}: {
  people: PersonOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const selected = people.filter((p) => value.includes(p.id));
  return (
    <Popover>
      <PopoverTrigger
        className="flex min-h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1.5">
            {selected.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
                <UserAvatar name={p.full_name || p.email} src={p.avatar_url} size="xs" />
                {p.full_name || p.email}
              </span>
            ))}
          </span>
        )}
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        {people.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No hay miembros.</p>
        ) : (
          people.map((p) => {
            const checked = value.includes(p.id);
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => onChange(checked ? value.filter((id) => id !== p.id) : [...value, p.id])}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <UserAvatar name={p.full_name || p.email} src={p.avatar_url} size="sm" />
                <span className="flex-1 truncate text-left">{p.full_name || p.email}</span>
                {checked ? <Check className="size-4 text-brand" /> : null}
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}

export function PeopleField<T extends FieldValues>({
  form,
  name,
  label,
  people,
  hint,
}: FormProp<T> & { name: string; label?: string; people: PersonOption[]; hint?: string }) {
  const f = asAny(form);
  return (
    <FormField label={label} hint={hint}>
      <Controller
        control={f.control as Control<FieldValues>}
        name={name}
        render={({ field }) => (
          <PeoplePicker people={people} value={(field.value as string[]) ?? []} onChange={field.onChange} />
        )}
      />
    </FormField>
  );
}
