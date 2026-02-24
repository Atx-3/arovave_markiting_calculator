/**
 * Dependency resolver — builds a dependency graph from formulas
 * and detects circular references via topological sort (Kahn's algorithm).
 */

import type {
    FormulaDefinition,
    DependencyGraph,
    CalculationError,
} from './types';

/**
 * Build a dependency graph from formula definitions.
 * Each formula's output_key depends on its operands.
 */
export function buildDependencyGraph(formulas: FormulaDefinition[]): DependencyGraph {
    const graph: DependencyGraph = new Map();

    // Initialize all formula output keys as nodes
    for (const formula of formulas) {
        if (!graph.has(formula.outputKey)) {
            graph.set(formula.outputKey, {
                key: formula.outputKey,
                dependsOn: [],
                dependedBy: [],
            });
        }
    }

    // Build edges: formula.outputKey depends on each operand that is also a formula output
    const formulaOutputKeys = new Set(formulas.map((f) => f.outputKey));

    for (const formula of formulas) {
        const node = graph.get(formula.outputKey)!;

        for (const operand of formula.operands) {
            // Extract the base key (handle "field.rate" notation)
            const baseKey = operand.split('.')[0];

            if (formulaOutputKeys.has(baseKey)) {
                // This operand is another formula's output — it's a dependency
                node.dependsOn.push(baseKey);

                // Also update the dependedBy on the target
                const targetNode = graph.get(baseKey);
                if (targetNode) {
                    targetNode.dependedBy.push(formula.outputKey);
                }
            }
        }

        // Also handle conditional branches
        if (formula.conditionalBranches) {
            for (const branch of formula.conditionalBranches) {
                // Condition references
                const leftBase = branch.condition.left.split('.')[0];
                const rightBase = branch.condition.right.split('.')[0];

                for (const ref of [leftBase, rightBase]) {
                    if (formulaOutputKeys.has(ref) && !node.dependsOn.includes(ref)) {
                        node.dependsOn.push(ref);
                        const targetNode = graph.get(ref);
                        if (targetNode) {
                            targetNode.dependedBy.push(formula.outputKey);
                        }
                    }
                }

                // Then-operand references
                if (branch.thenOperands) {
                    for (const operand of branch.thenOperands) {
                        const opBase = operand.split('.')[0];
                        if (formulaOutputKeys.has(opBase) && !node.dependsOn.includes(opBase)) {
                            node.dependsOn.push(opBase);
                            const targetNode = graph.get(opBase);
                            if (targetNode) {
                                targetNode.dependedBy.push(formula.outputKey);
                            }
                        }
                    }
                }
            }
        }
    }

    return graph;
}

/**
 * Detect circular references using Kahn's topological sort algorithm.
 * Returns any errors found (empty array = no circular references).
 */
export function detectCircularReferences(graph: DependencyGraph): CalculationError[] {
    const errors: CalculationError[] = [];

    // Calculate in-degrees
    const inDegree = new Map<string, number>();
    for (const [key, node] of graph) {
        inDegree.set(key, node.dependsOn.length);
    }

    // Start with nodes that have no dependencies
    const queue: string[] = [];
    for (const [key, degree] of inDegree) {
        if (degree === 0) {
            queue.push(key);
        }
    }

    let processedCount = 0;

    while (queue.length > 0) {
        const current = queue.shift()!;
        processedCount++;

        const node = graph.get(current);
        if (!node) continue;

        // Reduce in-degree for all nodes that depend on current
        for (const dependent of node.dependedBy) {
            const deg = (inDegree.get(dependent) ?? 0) - 1;
            inDegree.set(dependent, deg);
            if (deg === 0) {
                queue.push(dependent);
            }
        }
    }

    // If not all nodes were processed, there's a cycle
    if (processedCount < graph.size) {
        const cycleNodes: string[] = [];
        for (const [key] of graph) {
            if ((inDegree.get(key) ?? 0) > 0) {
                cycleNodes.push(key);
            }
        }

        errors.push({
            code: 'CIRCULAR_REFERENCE',
            message: `Circular reference detected among formulas: ${cycleNodes.join(' → ')}`,
        });
    }

    return errors;
}

/**
 * Get topologically sorted formula keys (execution order).
 * Returns null if circular reference exists.
 */
export function getExecutionOrder(
    formulas: FormulaDefinition[],
    graph: DependencyGraph,
): string[] | null {
    const inDegree = new Map<string, number>();
    for (const [key, node] of graph) {
        inDegree.set(key, node.dependsOn.length);
    }

    const queue: string[] = [];
    for (const [key, degree] of inDegree) {
        if (degree === 0) {
            queue.push(key);
        }
    }

    const order: string[] = [];

    while (queue.length > 0) {
        // Among nodes with in-degree 0, prefer lower order_index
        queue.sort((a, b) => {
            const fa = formulas.find((f) => f.outputKey === a);
            const fb = formulas.find((f) => f.outputKey === b);
            return (fa?.orderIndex ?? 0) - (fb?.orderIndex ?? 0);
        });

        const current = queue.shift()!;
        order.push(current);

        const node = graph.get(current);
        if (!node) continue;

        for (const dependent of node.dependedBy) {
            const deg = (inDegree.get(dependent) ?? 0) - 1;
            inDegree.set(dependent, deg);
            if (deg === 0) {
                queue.push(dependent);
            }
        }
    }

    if (order.length < graph.size) {
        return null; // Circular reference
    }

    return order;
}
