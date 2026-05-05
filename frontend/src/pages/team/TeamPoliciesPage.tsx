import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { getTeamPolicies, publishTeamPolicy } from "@/lib/policyApi";
import type {
  PolicyComponentCode,
  TeamPolicyResponse,
  PublishPolicyRequest,
} from "@/types/policies";
import {
  ArrowLeft,
  Loader2,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  Lock,
  RotateCcw,
  AlertCircle,
} from "lucide-react";

type TabKey = PolicyComponentCode;

type HsdRule = {
  id: string;
  name: string;
  pattern: string;
  severity: string;
  secretType?: string;
  description: string;
  enabled?: boolean;
};

type NetRule = {
  id: string;
  name: string;
  checkKey: string;
  severity: string;
  messageTemplate: string;
  description: string;
  enabled?: boolean;
};

type IdsRule = {
  id: string;
  name: string;
  checkKey: string;
  severity: string;
  category: string;
  riskLevel: string;
  patterns: string[];
  dataTypes: string[];
  requiresImport: string[];
  description: string;
  remediation: string;
};

type IivRule = {
  id: string;
  name: string;
  checkKey: string;
  severity: string;
  description: string;
  remediation: string;
  targetFunctions: string[];
};

type HsdHeuristics = {
  minLength: number;
  minEntropy: number;
  benignMarkers: string[];
  sensitiveKeywords: string[];
};

type EditorState = {
  HSD: {
    policy_name: string;
    policy_description: string;
    notes: string;
    rules_json: HsdRule[];
    heuristics_json: HsdHeuristics;
  };
  NET: {
    policy_name: string;
    policy_description: string;
    notes: string;
    rules_json: NetRule[];
  };
  IDS: {
    policy_name: string;
    policy_description: string;
    notes: string;
    rules_json: IdsRule[];
  };
  IIV: {
    policy_name: string;
    policy_description: string;
    notes: string;
    rules_json: IivRule[];
  };
};

const tabs: TabKey[] = ["HSD", "NET", "IDS", "IIV"];

function csvToArray(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function arrayToCsv(value: string[] | undefined): string {
  return (value ?? []).join(", ");
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function confirmDelete(label: string) {
  return window.confirm(`Are you sure you want to delete this ${label}?`);
}

function newHsdRule(): HsdRule {
  return {
    id: "",
    name: "",
    pattern: "",
    severity: "warning",
    secretType: "GENERIC_SECRET",
    description: "",
    enabled: true,
  };
}

function newNetRule(): NetRule {
  return {
    id: "",
    name: "",
    checkKey: "",
    severity: "warning",
    messageTemplate: "",
    description: "",
    enabled: true,
  };
}

function newIdsRule(): IdsRule {
  return {
    id: "",
    name: "",
    checkKey: "",
    severity: "warning",
    category: "insecure_storage",
    riskLevel: "MEDIUM",
    patterns: [],
    dataTypes: [],
    requiresImport: [],
    description: "",
    remediation: "",
  };
}

function newIivRule(): IivRule {
  return {
    id: "",
    name: "",
    checkKey: "",
    severity: "warning",
    description: "",
    remediation: "",
    targetFunctions: [],
  };
}

function emptyEditorState(): EditorState {
  return {
    HSD: {
      policy_name: "Default HSD Policy",
      policy_description: "",
      notes: "",
      rules_json: [],
      heuristics_json: {
        minLength: 10,
        minEntropy: 3.3,
        benignMarkers: [],
        sensitiveKeywords: [],
      },
    },
    NET: {
      policy_name: "Default NET Policy",
      policy_description: "",
      notes: "",
      rules_json: [],
    },
    IDS: {
      policy_name: "Default IDS Policy",
      policy_description: "",
      notes: "",
      rules_json: [],
    },
    IIV: {
      policy_name: "Default IIV Policy",
      policy_description: "",
      notes: "",
      rules_json: [],
    },
  };
}

function buildEditorState(data: TeamPolicyResponse): EditorState {
  const state = emptyEditorState();

  for (const tab of tabs) {
    const item = data.policies[tab];
    if (!item) continue;

    if (tab === "HSD") {
      state.HSD = {
        policy_name: item.policy_name,
        policy_description: item.policy_description ?? "",
        notes: item.notes ?? "",
        rules_json: (item.rules_json as HsdRule[]) ?? [],
        heuristics_json: {
          minLength: Number((item.heuristics_json as any)?.minLength ?? 10),
          minEntropy: Number((item.heuristics_json as any)?.minEntropy ?? 3.3),
          benignMarkers: Array.isArray(
            (item.heuristics_json as any)?.benignMarkers,
          )
            ? ((item.heuristics_json as any).benignMarkers as string[])
            : [],
          sensitiveKeywords: Array.isArray(
            (item.heuristics_json as any)?.sensitiveKeywords,
          )
            ? ((item.heuristics_json as any).sensitiveKeywords as string[])
            : [],
        },
      };
    }

    if (tab === "NET") {
      state.NET = {
        policy_name: item.policy_name,
        policy_description: item.policy_description ?? "",
        notes: item.notes ?? "",
        rules_json: (item.rules_json as NetRule[]) ?? [],
      };
    }

    if (tab === "IDS") {
      state.IDS = {
        policy_name: item.policy_name,
        policy_description: item.policy_description ?? "",
        notes: item.notes ?? "",
        rules_json: (item.rules_json as IdsRule[]) ?? [],
      };
    }

    if (tab === "IIV") {
      state.IIV = {
        policy_name: item.policy_name,
        policy_description: item.policy_description ?? "",
        notes: item.notes ?? "",
        rules_json: (item.rules_json as IivRule[]) ?? [],
      };
    }
  }

  return state;
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-secondary p-5 space-y-4">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-gray-300">{label}</span>
      {children}
    </label>
  );
}

function HsdEditor({
  value,
  onChange,
}: {
  value: EditorState["HSD"];
  onChange: (next: EditorState["HSD"]) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Policy Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Policy Name">
            <input
              className="input"
              value={value.policy_name}
              onChange={(e) =>
                onChange({ ...value, policy_name: e.target.value })
              }
            />
          </Field>

          <Field label="Notes">
            <input
              className="input"
              value={value.notes}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className="input min-h-24"
            value={value.policy_description}
            onChange={(e) =>
              onChange({ ...value, policy_description: e.target.value })
            }
          />
        </Field>
      </SectionCard>

      <SectionCard title="HSD Heuristics">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Minimum Length">
            <input
              className="input"
              type="number"
              value={value.heuristics_json.minLength}
              onChange={(e) =>
                onChange({
                  ...value,
                  heuristics_json: {
                    ...value.heuristics_json,
                    minLength: Number(e.target.value),
                  },
                })
              }
            />
          </Field>

          <Field label="Minimum Entropy">
            <input
              className="input"
              type="number"
              step="0.1"
              value={value.heuristics_json.minEntropy}
              onChange={(e) =>
                onChange({
                  ...value,
                  heuristics_json: {
                    ...value.heuristics_json,
                    minEntropy: Number(e.target.value),
                  },
                })
              }
            />
          </Field>
        </div>

        <Field label="Benign Markers (comma separated)">
          <input
            className="input"
            value={arrayToCsv(value.heuristics_json.benignMarkers)}
            onChange={(e) =>
              onChange({
                ...value,
                heuristics_json: {
                  ...value.heuristics_json,
                  benignMarkers: csvToArray(e.target.value),
                },
              })
            }
          />
        </Field>

        <Field label="Sensitive Keywords (comma separated)">
          <input
            className="input"
            value={arrayToCsv(value.heuristics_json.sensitiveKeywords)}
            onChange={(e) =>
              onChange({
                ...value,
                heuristics_json: {
                  ...value.heuristics_json,
                  sensitiveKeywords: csvToArray(e.target.value),
                },
              })
            }
          />
        </Field>
      </SectionCard>

      <SectionCard title="HSD Rules">
        <div className="space-y-4">
          {value.rules_json.map((rule, index) => (
            <div
              key={index}
              className="rounded-xl border border-surface-border bg-surface p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">
                  Rule {index + 1}
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (!confirmDelete("rule")) return;
                    const next = [...value.rules_json];
                    next.splice(index, 1);
                    onChange({ ...value, rules_json: next });
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="ID">
                  <input
                    className="input"
                    value={rule.id}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, id: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="Name">
                  <input
                    className="input"
                    value={rule.name}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, name: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="Pattern">
                  <input
                    className="input"
                    value={rule.pattern}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, pattern: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="Severity">
                  <select
                    className="input"
                    value={rule.severity}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, severity: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  >
                    <option value="warning">warning</option>
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="error">error</option>
                  </select>
                </Field>

                <Field label="Secret Type">
                  <input
                    className="input"
                    value={rule.secretType ?? ""}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, secretType: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  className="input min-h-20"
                  value={rule.description}
                  onChange={(e) => {
                    const next = [...value.rules_json];
                    next[index] = { ...rule, description: e.target.value };
                    onChange({ ...value, rules_json: next });
                  }}
                />
              </Field>
            </div>
          ))}

          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              onChange({
                ...value,
                rules_json: [...value.rules_json, newHsdRule()],
              })
            }
          >
            <Plus className="w-4 h-4" />
            Add HSD Rule
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

function NetEditor({
  value,
  onChange,
}: {
  value: EditorState["NET"];
  onChange: (next: EditorState["NET"]) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Policy Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Policy Name">
            <input
              className="input"
              value={value.policy_name}
              onChange={(e) =>
                onChange({ ...value, policy_name: e.target.value })
              }
            />
          </Field>
          <Field label="Notes">
            <input
              className="input"
              value={value.notes}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className="input min-h-24"
            value={value.policy_description}
            onChange={(e) =>
              onChange({ ...value, policy_description: e.target.value })
            }
          />
        </Field>
      </SectionCard>

      <SectionCard title="NET Rules">
        <div className="space-y-4">
          {value.rules_json.map((rule, index) => (
            <div
              key={index}
              className="rounded-xl border border-surface-border bg-surface p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">
                  Rule {index + 1}
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (!confirmDelete("rule")) return;
                    const next = [...value.rules_json];
                    next.splice(index, 1);
                    onChange({ ...value, rules_json: next });
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="ID">
                  <input
                    className="input"
                    value={rule.id}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, id: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="Name">
                  <input
                    className="input"
                    value={rule.name}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, name: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="checkKey">
                  <input
                    className="input"
                    value={rule.checkKey}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, checkKey: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="Severity">
                  <select
                    className="input"
                    value={rule.severity}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, severity: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  >
                    <option value="warning">warning</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </Field>
              </div>

              <Field label="Message Template">
                <input
                  className="input"
                  value={rule.messageTemplate}
                  onChange={(e) => {
                    const next = [...value.rules_json];
                    next[index] = { ...rule, messageTemplate: e.target.value };
                    onChange({ ...value, rules_json: next });
                  }}
                />
              </Field>

              <Field label="Description">
                <textarea
                  className="input min-h-20"
                  value={rule.description}
                  onChange={(e) => {
                    const next = [...value.rules_json];
                    next[index] = { ...rule, description: e.target.value };
                    onChange({ ...value, rules_json: next });
                  }}
                />
              </Field>
            </div>
          ))}

          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              onChange({
                ...value,
                rules_json: [...value.rules_json, newNetRule()],
              })
            }
          >
            <Plus className="w-4 h-4" />
            Add NET Rule
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

function IdsEditor({
  value,
  onChange,
}: {
  value: EditorState["IDS"];
  onChange: (next: EditorState["IDS"]) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Policy Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Policy Name">
            <input
              className="input"
              value={value.policy_name}
              onChange={(e) =>
                onChange({ ...value, policy_name: e.target.value })
              }
            />
          </Field>
          <Field label="Notes">
            <input
              className="input"
              value={value.notes}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className="input min-h-24"
            value={value.policy_description}
            onChange={(e) =>
              onChange({ ...value, policy_description: e.target.value })
            }
          />
        </Field>
      </SectionCard>

      <SectionCard title="IDS Rules">
        <div className="space-y-4">
          {value.rules_json.map((rule, index) => (
            <div
              key={index}
              className="rounded-xl border border-surface-border bg-surface p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">
                  Rule {index + 1}
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (!confirmDelete("rule")) return;
                    const next = [...value.rules_json];
                    next.splice(index, 1);
                    onChange({ ...value, rules_json: next });
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="ID">
                  <input
                    className="input"
                    value={rule.id}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, id: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="Name">
                  <input
                    className="input"
                    value={rule.name}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, name: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="checkKey">
                  <input
                    className="input"
                    value={rule.checkKey}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, checkKey: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="Severity">
                  <input
                    className="input"
                    value={rule.severity}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, severity: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="Category">
                  <input
                    className="input"
                    value={rule.category}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, category: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="Risk Level">
                  <input
                    className="input"
                    value={rule.riskLevel}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, riskLevel: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>
              </div>

              <Field label="Patterns (comma separated)">
                <input
                  className="input"
                  value={arrayToCsv(rule.patterns)}
                  onChange={(e) => {
                    const next = [...value.rules_json];
                    next[index] = {
                      ...rule,
                      patterns: csvToArray(e.target.value),
                    };
                    onChange({ ...value, rules_json: next });
                  }}
                />
              </Field>

              <Field label="Data Types (comma separated)">
                <input
                  className="input"
                  value={arrayToCsv(rule.dataTypes)}
                  onChange={(e) => {
                    const next = [...value.rules_json];
                    next[index] = {
                      ...rule,
                      dataTypes: csvToArray(e.target.value),
                    };
                    onChange({ ...value, rules_json: next });
                  }}
                />
              </Field>

              <Field label="Requires Import (comma separated)">
                <input
                  className="input"
                  value={arrayToCsv(rule.requiresImport)}
                  onChange={(e) => {
                    const next = [...value.rules_json];
                    next[index] = {
                      ...rule,
                      requiresImport: csvToArray(e.target.value),
                    };
                    onChange({ ...value, rules_json: next });
                  }}
                />
              </Field>

              <Field label="Description">
                <textarea
                  className="input min-h-20"
                  value={rule.description}
                  onChange={(e) => {
                    const next = [...value.rules_json];
                    next[index] = { ...rule, description: e.target.value };
                    onChange({ ...value, rules_json: next });
                  }}
                />
              </Field>

              <Field label="Remediation">
                <textarea
                  className="input min-h-20"
                  value={rule.remediation}
                  onChange={(e) => {
                    const next = [...value.rules_json];
                    next[index] = { ...rule, remediation: e.target.value };
                    onChange({ ...value, rules_json: next });
                  }}
                />
              </Field>
            </div>
          ))}

          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              onChange({
                ...value,
                rules_json: [...value.rules_json, newIdsRule()],
              })
            }
          >
            <Plus className="w-4 h-4" />
            Add IDS Rule
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

function IivEditor({
  value,
  onChange,
}: {
  value: EditorState["IIV"];
  onChange: (next: EditorState["IIV"]) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Policy Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Policy Name">
            <input
              className="input"
              value={value.policy_name}
              onChange={(e) =>
                onChange({ ...value, policy_name: e.target.value })
              }
            />
          </Field>
          <Field label="Notes">
            <input
              className="input"
              value={value.notes}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className="input min-h-24"
            value={value.policy_description}
            onChange={(e) =>
              onChange({ ...value, policy_description: e.target.value })
            }
          />
        </Field>
      </SectionCard>

      <SectionCard title="IIV Rules">
        <div className="space-y-4">
          {value.rules_json.map((rule, index) => (
            <div
              key={index}
              className="rounded-xl border border-surface-border bg-surface p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">
                  Rule {index + 1}
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (!confirmDelete("rule")) return;
                    const next = [...value.rules_json];
                    next.splice(index, 1);
                    onChange({ ...value, rules_json: next });
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="ID">
                  <input
                    className="input"
                    value={rule.id}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, id: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="Name">
                  <input
                    className="input"
                    value={rule.name}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, name: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="checkKey">
                  <input
                    className="input"
                    value={rule.checkKey}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, checkKey: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>

                <Field label="Severity">
                  <input
                    className="input"
                    value={rule.severity}
                    onChange={(e) => {
                      const next = [...value.rules_json];
                      next[index] = { ...rule, severity: e.target.value };
                      onChange({ ...value, rules_json: next });
                    }}
                  />
                </Field>
              </div>

              <Field label="Target Functions (comma separated)">
                <input
                  className="input"
                  value={arrayToCsv(rule.targetFunctions)}
                  onChange={(e) => {
                    const next = [...value.rules_json];
                    next[index] = {
                      ...rule,
                      targetFunctions: csvToArray(e.target.value),
                    };
                    onChange({ ...value, rules_json: next });
                  }}
                />
              </Field>

              <Field label="Description">
                <textarea
                  className="input min-h-20"
                  value={rule.description}
                  onChange={(e) => {
                    const next = [...value.rules_json];
                    next[index] = { ...rule, description: e.target.value };
                    onChange({ ...value, rules_json: next });
                  }}
                />
              </Field>

              <Field label="Remediation">
                <textarea
                  className="input min-h-20"
                  value={rule.remediation}
                  onChange={(e) => {
                    const next = [...value.rules_json];
                    next[index] = { ...rule, remediation: e.target.value };
                    onChange({ ...value, rules_json: next });
                  }}
                />
              </Field>
            </div>
          ))}

          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              onChange({
                ...value,
                rules_json: [...value.rules_json, newIivRule()],
              })
            }
          >
            <Plus className="w-4 h-4" />
            Add IIV Rule
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

export default function TeamPoliciesPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<TabKey>("HSD");
  const [data, setData] = useState<TeamPolicyResponse | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditorState());
  const [initialEditor, setInitialEditor] =
    useState<EditorState>(emptyEditorState());

  const isLeader = useMemo(
    () => Boolean(data?.team.leader_id && user?.id === data.team.leader_id),
    [data?.team.leader_id, user?.id],
  );

  const hasChanges = useMemo(() => {
    return JSON.stringify(editor[tab]) !== JSON.stringify(initialEditor[tab]);
  }, [editor, initialEditor, tab]);

  async function load() {
    if (!teamId) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await getTeamPolicies(teamId);
      setData(res.data);

      const built = buildEditorState(res.data);
      setEditor(deepClone(built));
      setInitialEditor(deepClone(built));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load team policies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [teamId]);

  function resetCurrentTab() {
    setEditor((prev) => ({
      ...prev,
      [tab]: deepClone(initialEditor[tab]),
    }));
    setSuccess("");
    setError("");
  }

  async function handlePublish(component: PolicyComponentCode) {
    if (!teamId) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let payload: PublishPolicyRequest;

      if (component === "HSD") {
        payload = {
          component_code: "HSD",
          policy_name: editor.HSD.policy_name,
          policy_description: editor.HSD.policy_description,
          rules_json: editor.HSD.rules_json,
          heuristics_json: editor.HSD.heuristics_json,
          notes: editor.HSD.notes,
        };
      } else if (component === "NET") {
        payload = {
          component_code: "NET",
          policy_name: editor.NET.policy_name,
          policy_description: editor.NET.policy_description,
          rules_json: editor.NET.rules_json,
          notes: editor.NET.notes,
        };
      } else if (component === "IDS") {
        payload = {
          component_code: "IDS",
          policy_name: editor.IDS.policy_name,
          policy_description: editor.IDS.policy_description,
          rules_json: editor.IDS.rules_json,
          notes: editor.IDS.notes,
        };
      } else {
        payload = {
          component_code: "IIV",
          policy_name: editor.IIV.policy_name,
          policy_description: editor.IIV.policy_description,
          rules_json: editor.IIV.rules_json,
          notes: editor.IIV.notes,
        };
      }

      const res = await publishTeamPolicy(teamId, payload);
      setData(res.data);

      const built = buildEditorState(res.data);
      setEditor(deepClone(built));
      setInitialEditor(deepClone(built));

      setSuccess(`${component} policy published and assigned successfully.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish policy");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading policy manager...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 space-y-4">
        <Link to="/team" className="btn-secondary inline-flex">
          <ArrowLeft className="w-4 h-4" />
          Back to Team Hub
        </Link>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
          {error || "Unable to load team policies."}
        </div>
      </div>
    );
  }

  const active = data.policies[tab];

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate(`/team/${teamId}`)}
            className="btn-secondary inline-flex"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Team
          </button>

          <div>
            <p className="text-sm text-brand-400 font-medium">
              Team Policy Manager
            </p>
            <h1 className="text-3xl font-bold text-white">{data.team.name}</h1>
            {data.team.description && (
              <p className="text-sm text-gray-400 mt-1">
                {data.team.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void load()}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>

          <button
            type="button"
            className="btn-secondary"
            disabled={!hasChanges || saving}
            onClick={resetCurrentTab}
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Active Policy
          </button>

          <button
            type="button"
            className="btn-primary"
            disabled={!isLeader || saving || !hasChanges}
            onClick={() => void handlePublish(tab)}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Publish {tab} Policy
          </button>
        </div>
      </div>

      {!isLeader && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          You can view policies, but only the team leader can publish changes.
        </div>
      )}

      {hasChanges && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-blue-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          You have unsaved changes in the {tab} policy.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-green-300">
          {success}
        </div>
      )}

      <div className="rounded-2xl border border-surface-border bg-surface-secondary p-3 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              tab === item
                ? "bg-brand-500 text-white"
                : "bg-surface text-gray-300 hover:bg-surface-tertiary"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-secondary p-5 flex flex-wrap gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Active Version
          </p>
          <p className="text-lg font-semibold text-white">
            {active ? `v${active.version_no}` : "Not assigned"}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Status
          </p>
          <p className="text-lg font-semibold text-white">
            {active?.status ?? "N/A"}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Assigned At
          </p>
          <p className="text-sm text-gray-300">
            {active?.assigned_at
              ? new Date(active.assigned_at).toLocaleString()
              : "N/A"}
          </p>
        </div>
      </div>

      {tab === "HSD" && (
        <HsdEditor
          value={editor.HSD}
          onChange={(next) => setEditor((prev) => ({ ...prev, HSD: next }))}
        />
      )}

      {tab === "NET" && (
        <NetEditor
          value={editor.NET}
          onChange={(next) => setEditor((prev) => ({ ...prev, NET: next }))}
        />
      )}

      {tab === "IDS" && (
        <IdsEditor
          value={editor.IDS}
          onChange={(next) => setEditor((prev) => ({ ...prev, IDS: next }))}
        />
      )}

      {tab === "IIV" && (
        <IivEditor
          value={editor.IIV}
          onChange={(next) => setEditor((prev) => ({ ...prev, IIV: next }))}
        />
      )}
    </div>
  );
}