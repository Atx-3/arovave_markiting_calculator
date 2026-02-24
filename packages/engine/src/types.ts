/**
 * Core type definitions for the Deterministic Pricing Engine.
 * All financial values are represented as strings (Decimal.js serialization).
 * No native JS floats allowed in any financial path.
 */

// ─── Template Schema Types ───────────────────────────────────────────

export type FieldType = 'number' | 'dropdown' | 'fixed' | 'formula' | 'conditional' | 'output';

export type OperationType =
    | 'add'
    | 'subtract'
    | 'multiply'
    | 'divide'
    | 'conditional'
    | 'custom';

export type RoundingMode =
    | 'ROUND_UP'
    | 'ROUND_DOWN'
    | 'ROUND_CEIL'
    | 'ROUND_FLOOR'
    | 'ROUND_HALF_UP'
    | 'ROUND_HALF_DOWN'
    | 'ROUND_HALF_EVEN';

export interface RoundingConfig {
    mode: RoundingMode;
    decimals: number;
    intermediateDecimals?: number; // defaults to decimals + 2
}

export interface FieldOption {
    label: string;
    value: string;
    rate: string; // Decimal string, e.g. "150.0000"
    metadata?: Record<string, unknown>;
}

export interface FieldDefinition {
    key: string;
    type: FieldType;
    label: string;
    sectionName?: string;
    isRequired: boolean;
    isVisible: boolean;
    defaultValue?: string;
    options?: FieldOption[]; // for dropdown type
    metadata?: Record<string, unknown>;
}

export interface ConditionalBranch {
    condition: ConditionExpression;
    thenOperands: string[];
    thenOperation: OperationType;
}

export interface ConditionExpression {
    left: string;       // field key or literal
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
    right: string;      // field key or literal
}

export interface FormulaDefinition {
    outputKey: string;
    operationType: OperationType;
    operands: string[];  // field keys or decimal string literals
    orderIndex: number;
    conditionalBranches?: ConditionalBranch[];
    label?: string;      // human-readable description
}

export interface SectionDefinition {
    name: string;
    orderIndex: number;
    fields: FieldDefinition[];
}

export interface TemplateSchema {
    productId: string;
    versionId: string;
    versionNumber: number;
    sections: SectionDefinition[];
    formulas: FormulaDefinition[];
    rounding: RoundingConfig;
}

// ─── Calculation Types ───────────────────────────────────────────────

export interface CalculationStep {
    orderIndex: number;
    outputKey: string;
    operationType: OperationType;
    operands: Array<{ key: string; value: string }>;
    result: string;
    label?: string;
}

export type CalculationErrorCode =
    | 'CIRCULAR_REFERENCE'
    | 'MISSING_REQUIRED_INPUT'
    | 'DIVISION_BY_ZERO'
    | 'INVALID_OPERAND'
    | 'UNKNOWN_FIELD_REF'
    | 'INVALID_OPERATION'
    | 'CONDITION_EVAL_ERROR';

export interface CalculationError {
    code: CalculationErrorCode;
    message: string;
    field?: string;
    formula?: string;
}

export interface CalculationResult {
    success: boolean;
    outputs: Record<string, string>;  // all computed values as Decimal strings
    total: string;                     // final total as Decimal string
    steps: CalculationStep[];          // audit trail
    errors: CalculationError[];        // any errors encountered
    inputHash?: string;                // SHA-256 of canonical inputs
}

// ─── Input Types ─────────────────────────────────────────────────────

export type InputValues = Record<string, string>;

// ─── Validation Types ────────────────────────────────────────────────

export interface ValidationError {
    field: string;
    message: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

// ─── Dependency Graph Types ──────────────────────────────────────────

export interface DependencyNode {
    key: string;
    dependsOn: string[];
    dependedBy: string[];
}

export type DependencyGraph = Map<string, DependencyNode>;
