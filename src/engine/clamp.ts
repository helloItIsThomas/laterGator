// ============================================================================
// Property Value Clamping
// Clamp after interpolation + property link evaluation, before rendering.
// ============================================================================

export interface PropertyClampRule {
  min?: number;
  max?: number;
}

const TRANSFORM_CLAMP_RULES: Record<string, PropertyClampRule> = {
  'transform.opacity': { min: 0, max: 1 },
};

const effectClampRules = new Map<string, PropertyClampRule>();

export function registerEffectClampRule(
  effectType: string,
  paramName: string,
  rule: PropertyClampRule,
): void {
  effectClampRules.set(`${effectType}.${paramName}`, rule);
}

export function clampPropertyValue(
  propertyPath: string,
  value: number,
): number {
  const rule =
    TRANSFORM_CLAMP_RULES[propertyPath] ??
    effectClampRules.get(propertyPath);
  if (!rule) return value;
  let v = value;
  if (rule.min !== undefined) v = Math.max(rule.min, v);
  if (rule.max !== undefined) v = Math.min(rule.max, v);
  return v;
}
