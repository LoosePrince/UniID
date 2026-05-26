"use client";

import * as React from "react";
import { Braces, Copy, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  CalloutDescription,
  CalloutTitle,
  CodeBlock,
  Field,
  Input,
  Select,
  Textarea
} from "@/ui/primitives";

export type SchemaFieldType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "enum";

export interface SchemaFieldModel {
  id: string;
  name: string;
  type: SchemaFieldType;
  required: boolean;
  description: string;
  format: string;
  enumValues: string;
  defaultValue: string;
  minimum: string;
  maximum: string;
  minLength: string;
  maxLength: string;
  pattern: string;
  fields: SchemaFieldModel[];
  arrayItem?: SchemaFieldModel;
}

export interface AutoFillRuleModel {
  id: string;
  path: string;
  kind: "token" | "string" | "number" | "boolean" | "null" | "json";
  value: string;
}

const unsupportedSchemaKeys = [
  "$ref",
  "oneOf",
  "anyOf",
  "allOf",
  "not",
  "if",
  "then",
  "else",
  "patternProperties",
  "dependentSchemas",
  "dependencies"
];

const tokenOptions = [
  "$serverTime",
  "$serverTimeMs",
  "$userId",
  "$username",
  "$appId",
  "$ip",
  "$requestId",
  "$sessionId",
  "$op"
];

const fieldTypeOptions = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "integer", label: "integer" },
  { value: "boolean", label: "boolean" },
  { value: "object", label: "object" },
  { value: "array", label: "array" },
  { value: "enum", label: "enum" }
];

const autoFillKindOptions = [
  { value: "token", label: "token" },
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "boolean", label: "boolean" },
  { value: "null", label: "null" },
  { value: "json", label: "json" }
];

const booleanValueOptions = [
  { value: "true", label: "true" },
  { value: "false", label: "false" }
];

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

export function createSchemaField(overrides: Partial<SchemaFieldModel> = {}): SchemaFieldModel {
  const base: SchemaFieldModel = {
    id: createId(),
    name: "field",
    type: "string",
    required: false,
    description: "",
    format: "",
    enumValues: "",
    defaultValue: "",
    minimum: "",
    maximum: "",
    minLength: "",
    maxLength: "",
    pattern: "",
    fields: []
  };
  const field = { ...base, ...overrides };
  if (field.type === "array" && !field.arrayItem) {
    field.arrayItem = createSchemaField({ name: "items", required: false });
  }
  return field;
}

export function createAutoFillRule(overrides: Partial<AutoFillRuleModel> = {}): AutoFillRuleModel {
  return {
    id: createId(),
    path: "data.createdAt",
    kind: "token",
    value: "$serverTime",
    ...overrides
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanObject(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function assertNumberLike(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  if (!Number.isFinite(Number(trimmed))) throw new Error(`${label} 必须是有效数字。`);
}

function assertPattern(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  try {
    new RegExp(trimmed);
  } catch {
    throw new Error(`${label} 不是有效正则表达式。`);
  }
}

function assertUniqueFieldNames(fields: SchemaFieldModel[], scope = "root") {
  const names = new Set<string>();
  for (const field of fields) {
    const name = field.name.trim();
    if (!name) throw new Error(`${scope} 存在空字段名。`);
    if (names.has(name)) throw new Error(`${scope} 存在重复字段名：${name}。`);
    names.add(name);
    validateSchemaField(field, `${scope}.${name}`);
  }
}

function validateSchemaField(field: SchemaFieldModel, path: string) {
  assertNumberLike(field.minimum, `${path}.minimum`);
  assertNumberLike(field.maximum, `${path}.maximum`);
  assertNumberLike(field.minLength, `${path}.minLength`);
  assertNumberLike(field.maxLength, `${path}.maxLength`);
  assertPattern(field.pattern, `${path}.pattern`);

  if (field.type === "enum") {
    const values = field.enumValues
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (values.length === 0) throw new Error(`${path}.enum 至少需要一个选项。`);
  }

  if (field.type === "object") assertUniqueFieldNames(field.fields, path);
  if (field.type === "array" && field.arrayItem) validateSchemaField(field.arrayItem, `${path}[]`);
}

export function validateSchemaFields(fields: SchemaFieldModel[]) {
  assertUniqueFieldNames(fields);
}

function parseDefaultValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

function schemaForField(field: SchemaFieldModel): Record<string, unknown> {
  const description = field.description.trim() || undefined;
  const defaultValue = parseDefaultValue(field.defaultValue);

  if (field.type === "enum") {
    const values = field.enumValues
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return cleanObject({
      type: "string",
      enum: values.length > 0 ? values : ["draft", "published"],
      description,
      default: defaultValue
    });
  }

  if (field.type === "object") {
    return cleanObject({
      type: "object",
      properties: propertiesFromFields(field.fields),
      required: requiredFromFields(field.fields),
      additionalProperties: false,
      description,
      default: defaultValue
    });
  }

  if (field.type === "array") {
    return cleanObject({
      type: "array",
      items: field.arrayItem ? schemaForField(field.arrayItem) : {},
      description,
      default: defaultValue
    });
  }

  if (field.type === "string") {
    return cleanObject({
      type: "string",
      description,
      format: field.format.trim() || undefined,
      minLength: parseNumber(field.minLength),
      maxLength: parseNumber(field.maxLength),
      pattern: field.pattern.trim() || undefined,
      default: defaultValue
    });
  }

  if (field.type === "number" || field.type === "integer") {
    return cleanObject({
      type: field.type,
      description,
      minimum: parseNumber(field.minimum),
      maximum: parseNumber(field.maximum),
      default: defaultValue
    });
  }

  return cleanObject({
    type: "boolean",
    description,
    default: defaultValue
  });
}

function propertiesFromFields(fields: SchemaFieldModel[]) {
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    const name = field.name.trim();
    if (!name) return acc;
    acc[name] = schemaForField(field);
    return acc;
  }, {});
}

function requiredFromFields(fields: SchemaFieldModel[]) {
  const required = fields.map((field) => field.name.trim()).filter((name, index) => fields[index]?.required && name);
  return required.length > 0 ? required : undefined;
}

export function schemaFieldsToJsonSchema(fields: SchemaFieldModel[]): Record<string, unknown> {
  return cleanObject({
    type: "object",
    properties: propertiesFromFields(fields),
    required: requiredFromFields(fields),
    additionalProperties: fields.length === 0 ? true : false
  });
}

function hasUnsupportedKeys(schema: Record<string, unknown>) {
  return unsupportedSchemaKeys.some((key) => key in schema);
}

function schemaTypeOf(schema: Record<string, unknown>): SchemaFieldType | null {
  if (Array.isArray(schema.enum)) return "enum";
  if (schema.type === "object" || isRecord(schema.properties)) return "object";
  if (schema.type === "array") return "array";
  if (schema.type === "string") return "string";
  if (schema.type === "number") return "number";
  if (schema.type === "integer") return "integer";
  if (schema.type === "boolean") return "boolean";
  return null;
}

function fieldFromSchema(name: string, schema: Record<string, unknown>, required: boolean): SchemaFieldModel | null {
  if (hasUnsupportedKeys(schema)) return null;
  const type = schemaTypeOf(schema);
  if (!type) return null;

  const field = createSchemaField({
    name,
    type,
    required,
    description: typeof schema.description === "string" ? schema.description : "",
    format: typeof schema.format === "string" ? schema.format : "",
    enumValues: Array.isArray(schema.enum) ? schema.enum.map(String).join("\n") : "",
    defaultValue: schema.default === undefined ? "" : JSON.stringify(schema.default),
    minimum: schema.minimum === undefined ? "" : String(schema.minimum),
    maximum: schema.maximum === undefined ? "" : String(schema.maximum),
    minLength: schema.minLength === undefined ? "" : String(schema.minLength),
    maxLength: schema.maxLength === undefined ? "" : String(schema.maxLength),
    pattern: typeof schema.pattern === "string" ? schema.pattern : ""
  });

  if (type === "object") {
    const properties = isRecord(schema.properties) ? schema.properties : {};
    const nestedRequired = Array.isArray(schema.required) ? schema.required.map(String) : [];
    const nested = Object.entries(properties)
      .map(([childName, childSchema]) => isRecord(childSchema) ? fieldFromSchema(childName, childSchema, nestedRequired.includes(childName)) : null)
      .filter(Boolean) as SchemaFieldModel[];
    if (Object.keys(properties).length !== nested.length) return null;
    return { ...field, fields: nested };
  }

  if (type === "array") {
    const itemSchema = isRecord(schema.items) ? schema.items : { type: "string" };
    const arrayItem = fieldFromSchema("items", itemSchema, false);
    if (!arrayItem) return null;
    return { ...field, arrayItem };
  }

  return field;
}

export function jsonSchemaToFields(schema: Record<string, unknown>): { ok: true; fields: SchemaFieldModel[] } | { ok: false; reason: string } {
  if (hasUnsupportedKeys(schema)) return { ok: false, reason: "包含组合、引用或动态属性关键字，需要使用高级 JSON 模式。" };
  if (schema.type !== "object" && !isRecord(schema.properties)) {
    return { ok: false, reason: "当前可视化编辑器只支持 object 根结构。" };
  }
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
  const fields = Object.entries(properties)
    .map(([name, childSchema]) => isRecord(childSchema) ? fieldFromSchema(name, childSchema, required.includes(name)) : null)
    .filter(Boolean) as SchemaFieldModel[];
  if (Object.keys(properties).length !== fields.length) {
    return { ok: false, reason: "存在暂不支持的字段关键字，需要使用高级 JSON 模式。" };
  }
  return { ok: true, fields };
}

function updateField(fields: SchemaFieldModel[], id: string, updater: (field: SchemaFieldModel) => SchemaFieldModel): SchemaFieldModel[] {
  return fields.map((field) => {
    if (field.id === id) return updater(field);
    return {
      ...field,
      fields: updateField(field.fields, id, updater),
      arrayItem: field.arrayItem ? updateField([field.arrayItem], id, updater)[0] : undefined
    };
  });
}

function insertFieldAfter(fields: SchemaFieldModel[], id: string, nextField: SchemaFieldModel): SchemaFieldModel[] {
  const output: SchemaFieldModel[] = [];
  for (const field of fields) {
    output.push({
      ...field,
      fields: insertFieldAfter(field.fields, id, nextField),
      arrayItem: field.arrayItem ? insertFieldAfter([field.arrayItem], id, nextField)[0] : undefined
    });
    if (field.id === id) output.push(nextField);
  }
  return output;
}

function deleteField(fields: SchemaFieldModel[], id: string): SchemaFieldModel[] {
  return fields
    .filter((field) => field.id !== id)
    .map((field) => ({
      ...field,
      fields: deleteField(field.fields, id),
      arrayItem: field.arrayItem?.id === id ? field.arrayItem : field.arrayItem ? deleteField([field.arrayItem], id)[0] : undefined
    }));
}

function withType(field: SchemaFieldModel, type: SchemaFieldType): SchemaFieldModel {
  if (type === "array") {
    return { ...field, type, fields: [], arrayItem: field.arrayItem ?? createSchemaField({ name: "items", required: false }) };
  }
  if (type === "object") {
    return { ...field, type, fields: field.fields, arrayItem: undefined };
  }
  return { ...field, type, fields: [], arrayItem: undefined };
}

const templates: Array<{ name: string; fields: SchemaFieldModel[] }> = [
  {
    name: "posts",
    fields: [
      createSchemaField({ name: "title", required: true, minLength: "2" }),
      createSchemaField({ name: "slug", required: true, pattern: "^[a-z0-9-]+$" }),
      createSchemaField({ name: "content", type: "string" }),
      createSchemaField({ name: "status", type: "enum", required: true, enumValues: "draft\npublished" }),
      createSchemaField({ name: "publishedAt", type: "integer" })
    ]
  },
  {
    name: "profile",
    fields: [
      createSchemaField({ name: "displayName", required: true }),
      createSchemaField({ name: "avatarUrl", format: "uri" }),
      createSchemaField({ name: "bio", maxLength: "240" }),
      createSchemaField({ name: "settings", type: "object", fields: [createSchemaField({ name: "emailVisible", type: "boolean" })] })
    ]
  },
  {
    name: "settings",
    fields: [
      createSchemaField({ name: "theme", type: "enum", enumValues: "system\nlight\ndark" }),
      createSchemaField({ name: "locale", type: "string", defaultValue: "zh-CN" }),
      createSchemaField({ name: "notifications", type: "boolean", defaultValue: "true" })
    ]
  }
];

export function SchemaBuilder({
  fields,
  onChange,
  disabled
}: {
  fields: SchemaFieldModel[];
  onChange: (fields: SchemaFieldModel[]) => void;
  disabled?: boolean;
}) {
  const preview = JSON.stringify(schemaFieldsToJsonSchema(fields), null, 2);

  function addRootField() {
    onChange([...fields, createSchemaField({ name: `field${fields.length + 1}` })]);
  }

  function setTemplate(templateFields: SchemaFieldModel[]) {
    onChange(templateFields.map((field) => cloneField(field)));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={addRootField} disabled={disabled}>
            <Plus /> 添加字段
          </Button>
          <span className="text-xs text-ink-400">模板</span>
          {templates.map((template) => (
            <Button key={template.name} type="button" variant="outline" size="sm" onClick={() => setTemplate(template.fields)} disabled={disabled}>
              {template.name}
            </Button>
          ))}
        </div>

        {fields.length === 0 ? (
          <Callout tone="info">
            <CalloutTitle>当前 Schema 还没有字段</CalloutTitle>
            <CalloutDescription>添加字段或选择模板后，会自动生成标准 JSON Schema。</CalloutDescription>
          </Callout>
        ) : (
          <div className="space-y-3">
            {fields.map((field) => (
              <SchemaFieldNode
                key={field.id}
                field={field}
                disabled={disabled}
                depth={0}
                onUpdate={(id, updater) => onChange(updateField(fields, id, updater))}
                onDuplicate={(fieldToCopy) => onChange(insertFieldAfter(fields, fieldToCopy.id, cloneField(fieldToCopy, `${fieldToCopy.name}Copy`)))}
                onDelete={(id) => onChange(deleteField(fields, id))}
              />
            ))}
          </div>
        )}
      </div>

      <CodeBlock title="实时 JSON Schema" language="json" value={preview} maxHeight="34rem" />
    </div>
  );
}

function cloneField(field: SchemaFieldModel, name = field.name): SchemaFieldModel {
  return {
    ...field,
    id: createId(),
    name,
    fields: field.fields.map((child) => cloneField(child)),
    arrayItem: field.arrayItem ? cloneField(field.arrayItem) : undefined
  };
}

function SchemaFieldNode({
  field,
  depth,
  disabled,
  onUpdate,
  onDuplicate,
  onDelete,
  arrayItem
}: {
  field: SchemaFieldModel;
  depth: number;
  disabled?: boolean;
  onUpdate: (id: string, updater: (field: SchemaFieldModel) => SchemaFieldModel) => void;
  onDuplicate: (field: SchemaFieldModel) => void;
  onDelete: (id: string) => void;
  arrayItem?: boolean;
}) {
  function patch(patchValue: Partial<SchemaFieldModel>) {
    onUpdate(field.id, (current) => ({ ...current, ...patchValue }));
  }

  function addNestedField() {
    onUpdate(field.id, (current) => ({
      ...current,
      fields: [...current.fields, createSchemaField({ name: `field${current.fields.length + 1}` })]
    }));
  }

  return (
    <div className="rounded-xl border border-ink-200/70 bg-white/60 p-4 shadow-xs backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60" style={{ marginLeft: depth ? 14 : 0 }}>
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_150px_110px_auto] lg:items-end">
        <Field label={arrayItem ? "数组元素" : "字段名"}>
          <Input
            value={arrayItem ? "items" : field.name}
            onChange={(event) => patch({ name: event.target.value })}
            disabled={disabled || arrayItem}
            placeholder="title"
          />
        </Field>
        <Field label="类型">
          <Select
            value={field.type}
            onValueChange={(value) => onUpdate(field.id, (current) => withType(current, value as SchemaFieldType))}
            disabled={disabled}
            options={fieldTypeOptions}
          />
        </Field>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-ink-200/70 bg-white/50 px-3 text-sm text-ink-700 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 accent-ink-900"
            checked={field.required}
            disabled={disabled || arrayItem}
            onChange={(event) => patch({ required: event.target.checked })}
          />
          必填
        </label>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={() => onDuplicate(field)} disabled={disabled || arrayItem} aria-label="复制字段">
            <Copy />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(field.id)} disabled={disabled || arrayItem} aria-label="删除字段">
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="描述">
          <Input value={field.description} onChange={(event) => patch({ description: event.target.value })} disabled={disabled} placeholder="字段用途" />
        </Field>
        <Field label="默认值">
          <Input value={field.defaultValue} onChange={(event) => patch({ defaultValue: event.target.value })} disabled={disabled} placeholder="可填 JSON 或文本" />
        </Field>
      </div>

      {field.type === "string" ? (
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Field label="format"><Input value={field.format} onChange={(event) => patch({ format: event.target.value })} disabled={disabled} placeholder="email / uri" /></Field>
          <Field label="minLength"><Input value={field.minLength} onChange={(event) => patch({ minLength: event.target.value })} disabled={disabled} inputMode="numeric" /></Field>
          <Field label="maxLength"><Input value={field.maxLength} onChange={(event) => patch({ maxLength: event.target.value })} disabled={disabled} inputMode="numeric" /></Field>
          <Field label="pattern"><Input value={field.pattern} onChange={(event) => patch({ pattern: event.target.value })} disabled={disabled} placeholder="^[a-z]+$" /></Field>
        </div>
      ) : null}

      {(field.type === "number" || field.type === "integer") ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="minimum"><Input value={field.minimum} onChange={(event) => patch({ minimum: event.target.value })} disabled={disabled} inputMode="decimal" /></Field>
          <Field label="maximum"><Input value={field.maximum} onChange={(event) => patch({ maximum: event.target.value })} disabled={disabled} inputMode="decimal" /></Field>
        </div>
      ) : null}

      {field.type === "enum" ? (
        <Field className="mt-3" label="枚举选项" help="一行一个，或用英文逗号分隔。">
          <Textarea value={field.enumValues} onChange={(event) => patch({ enumValues: event.target.value })} disabled={disabled} className="min-h-24 font-mono text-xs" />
        </Field>
      ) : null}

      {field.type === "object" ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge tone="neutral">object fields</Badge>
            <Button type="button" variant="outline" size="sm" onClick={addNestedField} disabled={disabled}>
              <Plus /> 添加子字段
            </Button>
          </div>
          {field.fields.map((child) => (
            <SchemaFieldNode key={child.id} field={child} depth={depth + 1} disabled={disabled} onUpdate={onUpdate} onDuplicate={onDuplicate} onDelete={onDelete} />
          ))}
        </div>
      ) : null}

      {field.type === "array" && field.arrayItem ? (
        <div className="mt-4 space-y-2">
          <Badge tone="neutral">array items</Badge>
          <SchemaFieldNode field={field.arrayItem} depth={depth + 1} disabled={disabled} onUpdate={onUpdate} onDuplicate={onDuplicate} onDelete={onDelete} arrayItem />
        </div>
      ) : null}
    </div>
  );
}

export function autoFillObjectToRules(source: Record<string, unknown> | undefined): AutoFillRuleModel[] {
  if (!source) return [];
  return Object.entries(source).map(([path, value]) => {
    if (typeof value === "string" && value.startsWith("$")) return createAutoFillRule({ path, kind: "token", value });
    if (typeof value === "string") return createAutoFillRule({ path, kind: "string", value });
    if (typeof value === "number") return createAutoFillRule({ path, kind: "number", value: String(value) });
    if (typeof value === "boolean") return createAutoFillRule({ path, kind: "boolean", value: String(value) });
    if (value === null) return createAutoFillRule({ path, kind: "null", value: "" });
    return createAutoFillRule({ path, kind: "json", value: JSON.stringify(value, null, 2) });
  });
}

export function autoFillRulesToObject(rules: AutoFillRuleModel[]): Record<string, unknown> | undefined {
  const output: Record<string, unknown> = {};
  for (const rule of rules) {
    const path = rule.path.trim();
    if (!path) continue;
    if (rule.kind === "token") output[path] = rule.value.trim() || "$serverTime";
    if (rule.kind === "string") output[path] = rule.value;
    if (rule.kind === "number") {
      const n = Number(rule.value);
      if (!Number.isFinite(n)) throw new Error(`AutoFill ${path} 必须是数字。`);
      output[path] = n;
    }
    if (rule.kind === "boolean") output[path] = rule.value === "true";
    if (rule.kind === "null") output[path] = null;
    if (rule.kind === "json") {
      try {
        output[path] = JSON.parse(rule.value);
      } catch {
        throw new Error(`AutoFill ${path} 的 JSON 值不合法。`);
      }
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

export function AutoFillBuilder({
  rules,
  onChange,
  disabled
}: {
  rules: AutoFillRuleModel[];
  onChange: (rules: AutoFillRuleModel[]) => void;
  disabled?: boolean;
}) {
  let preview = "{}";
  try {
    preview = JSON.stringify(autoFillRulesToObject(rules) ?? {}, null, 2);
  } catch {
    preview = "// AutoFill 配置存在未完成的值";
  }

  function patchRule(id: string, patch: Partial<AutoFillRuleModel>) {
    onChange(rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-3">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rules, createAutoFillRule()])} disabled={disabled}>
          <Plus /> 添加填充规则
        </Button>
        {rules.length === 0 ? (
          <Callout tone="info" icon={Braces}>
            <CalloutTitle>未配置 AutoFill</CalloutTitle>
            <CalloutDescription>可为 data.createdAt、data.authorId 等路径自动填入服务端可信值。</CalloutDescription>
          </Callout>
        ) : rules.map((rule) => (
          <div key={rule.id} className="rounded-xl border border-ink-200/70 bg-white/60 p-4 shadow-xs backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60">
            <div className="grid gap-3 lg:grid-cols-[1fr_150px_1fr_auto] lg:items-end">
              <Field label="path">
                <Input value={rule.path} onChange={(event) => patchRule(rule.id, { path: event.target.value })} disabled={disabled} placeholder="data.createdAt" />
              </Field>
              <Field label="value type">
                <Select
                  value={rule.kind}
                  onValueChange={(value) => patchRule(rule.id, { kind: value as AutoFillRuleModel["kind"] })}
                  disabled={disabled}
                  options={autoFillKindOptions}
                />
              </Field>
              <AutoFillValueInput rule={rule} onChange={(value) => patchRule(rule.id, { value })} disabled={disabled} />
              <Button type="button" variant="ghost" size="icon" onClick={() => onChange(rules.filter((item) => item.id !== rule.id))} disabled={disabled} aria-label="删除 AutoFill 规则">
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <CodeBlock title="AutoFill JSON" language="json" value={preview} maxHeight="28rem" />
    </div>
  );
}

function AutoFillValueInput({
  rule,
  onChange,
  disabled
}: {
  rule: AutoFillRuleModel;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  if (rule.kind === "token") {
    return (
      <Field label="value">
        <Select
          value={rule.value || "$serverTime"}
          onValueChange={onChange}
          disabled={disabled}
          options={tokenOptions.map((token) => ({ value: token, label: token }))}
        />
      </Field>
    );
  }
  if (rule.kind === "boolean") {
    return (
      <Field label="value">
        <Select value={rule.value || "true"} onValueChange={onChange} disabled={disabled} options={booleanValueOptions} />
      </Field>
    );
  }
  if (rule.kind === "null") {
    return <Field label="value"><Input value="null" disabled /></Field>;
  }
  if (rule.kind === "json") {
    return (
      <Field label="value">
        <Textarea value={rule.value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="min-h-20 font-mono text-xs" placeholder="{ }" />
      </Field>
    );
  }
  return (
    <Field label="value">
      <Input value={rule.value} onChange={(event) => onChange(event.target.value)} disabled={disabled} inputMode={rule.kind === "number" ? "decimal" : undefined} />
    </Field>
  );
}

export function parseJsonRecord(source: string): Record<string, unknown> {
  const parsed = JSON.parse(source) as unknown;
  if (!isRecord(parsed)) throw new Error("必须是 JSON object。 ");
  return parsed;
}