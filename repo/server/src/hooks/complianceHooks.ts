export interface ComplianceResult {
  allow: boolean;
  reason?: string;
}

type HookFn = (data: any) => Promise<ComplianceResult>;

const hooks: Record<string, HookFn[]> = {
  beforeContentPublish: [],
  beforeVerificationApprove: [],
  beforeExport: [],
  beforeSettlementFinalize: [],
};

export function registerHook(event: string, fn: HookFn): void {
  if (!hooks[event]) hooks[event] = [];
  hooks[event].push(fn);
}

async function runHook(event: string, data: any): Promise<ComplianceResult> {
  const fns = hooks[event] || [];
  for (const fn of fns) {
    const result = await fn(data);
    if (!result.allow) return result;
  }
  return { allow: true };
}

export async function beforeContentPublish(content: any): Promise<ComplianceResult> {
  return runHook('beforeContentPublish', content);
}

export async function beforeVerificationApprove(verification: any): Promise<ComplianceResult> {
  return runHook('beforeVerificationApprove', verification);
}

export async function beforeExport(data: { userId: string; resourceType: string }): Promise<ComplianceResult> {
  return runHook('beforeExport', data);
}

export async function beforeSettlementFinalize(settlement: any): Promise<ComplianceResult> {
  return runHook('beforeSettlementFinalize', settlement);
}
