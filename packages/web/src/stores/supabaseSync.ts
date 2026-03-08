/**
 * Supabase Sync — Separate Tables
 * Handles syncing categories, input_definitions, input_groups, and calculators
 * to/from Supabase with Realtime for cross-device updates.
 *
 * Uses UPSERT + selective delete to avoid the delete-then-insert race condition
 * that caused the data wipeout loop.
 */

import { supabase } from '../lib/supabase';
import type {
    Category,
    InputDefinition,
    InputGroup,
    Calculator,
} from '../types/calculator';

// ── Store reference (set once during init) ──

let storeRef: any = null;

// ── State ──

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let isSyncingFromRemote = false;

// ── Converters: Store ↔ DB ──

function categoryToRow(c: Category) {
    return { id: c.id, name: c.name, parent_id: c.parentId, sort_order: c.order };
}
function rowToCategory(r: any): Category {
    return { id: r.id, name: r.name, parentId: r.parent_id ?? null, order: r.sort_order ?? 0 };
}

function inputDefToRow(d: InputDefinition) {
    return {
        id: d.id, name: d.name, key: d.key, type: d.type, rate: d.rate,
        fixed_value: d.fixedValue ?? null,
        dropdown_options: d.dropdownOptions ?? [],
        ref_tree: d.refTree ?? null,
        reference_items: d.referenceItems ?? [],
        sort_order: d.order, group_id: d.groupId ?? null,
        is_required: d.isRequired ?? false,
    };
}
function rowToInputDef(r: any): InputDefinition {
    return {
        id: r.id, name: r.name, key: r.key, type: r.type, rate: r.rate ?? '0',
        fixedValue: r.fixed_value ?? undefined,
        dropdownOptions: r.dropdown_options ?? [],
        refTree: r.ref_tree ?? undefined,
        referenceItems: r.reference_items ?? [],
        order: r.sort_order ?? 0, groupId: r.group_id ?? undefined,
        isRequired: r.is_required ?? false,
    };
}

function inputGroupToRow(g: InputGroup) {
    return { id: g.id, name: g.name, sort_order: g.order };
}
function rowToInputGroup(r: any): InputGroup {
    return { id: r.id, name: r.name, order: r.sort_order ?? 0 };
}

function calculatorToRow(c: Calculator) {
    return {
        id: c.id, name: c.name, category_id: c.categoryId,
        formulas: c.formulas ?? [],
        local_rates: c.localRates ?? [],
        used_input_ids: c.usedInputIds ?? [],
        profit_percent: c.profitPercent ?? '0',
    };
}
function rowToCalculator(r: any): Calculator {
    return {
        id: r.id, name: r.name, categoryId: r.category_id,
        formulas: r.formulas ?? [],
        localRates: r.local_rates ?? [],
        usedInputIds: r.used_input_ids ?? [],
        profitPercent: r.profit_percent ?? '0',
    };
}

// ── Sync a table: upsert current rows + delete removed rows ──

async function syncTable(table: string, rows: any[]) {
    // 1. Upsert all current rows (atomic, no intermediate empty state)
    if (rows.length > 0) {
        const { error: upsertError } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
        if (upsertError) {
            console.error(`❌ Upsert ${table} failed:`, upsertError.message);
            return false;
        }
    }

    // 2. Delete rows that no longer exist locally
    const currentIds = rows.map(r => r.id);
    if (currentIds.length > 0) {
        const { error: delError } = await supabase.from(table).delete().not('id', 'in', `(${currentIds.join(',')})`);
        if (delError) {
            console.error(`❌ Cleanup ${table} failed:`, delError.message);
        }
    } else {
        // No local rows — delete everything
        const { error: delError } = await supabase.from(table).delete().neq('id', '___never___');
        if (delError) {
            console.error(`❌ Clear ${table} failed:`, delError.message);
        }
    }

    return true;
}

/**
 * Save ALL store data to Supabase (4 separate tables).
 * Uses upsert to avoid the delete-then-insert race condition.
 */
async function saveToSupabase() {
    if (isSyncingFromRemote || !storeRef) return;

    const state = storeRef.getState();

    const results = await Promise.all([
        syncTable('categories', state.categories.map(categoryToRow)),
        syncTable('input_definitions', state.inputDefinitions.map(inputDefToRow)),
        syncTable('input_groups', state.inputGroups.map(inputGroupToRow)),
        syncTable('calculators', state.calculators.map(calculatorToRow)),
    ]);

    if (results.every(Boolean)) {
        console.log('✅ All data saved to Supabase (4 tables)');
    } else {
        console.error('❌ Some tables failed to sync');
    }
}

/**
 * Load ALL data from Supabase (4 separate tables) into local store.
 */
async function loadFromSupabase() {
    if (!storeRef) return;

    const [catRes, inputRes, groupRes, calcRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('input_definitions').select('*').order('sort_order'),
        supabase.from('input_groups').select('*').order('sort_order'),
        supabase.from('calculators').select('*'),
    ]);

    const hasRemoteData =
        (catRes.data && catRes.data.length > 0) ||
        (inputRes.data && inputRes.data.length > 0) ||
        (calcRes.data && calcRes.data.length > 0);

    if (hasRemoteData) {
        console.log('📦 Loaded data from Supabase tables');
        isSyncingFromRemote = true;

        storeRef.setState({
            categories: (catRes.data || []).map(rowToCategory),
            inputDefinitions: (inputRes.data || []).map(rowToInputDef),
            inputGroups: (groupRes.data || []).map(rowToInputGroup),
            calculators: (calcRes.data || []).map(rowToCalculator),
        });

        setTimeout(() => { isSyncingFromRemote = false; }, 500);
    } else {
        // DB is empty — push local data
        const state = storeRef.getState();
        const hasLocalData =
            state.categories.length > 0 ||
            state.inputDefinitions.length > 0 ||
            state.calculators.length > 0;

        if (hasLocalData) {
            console.log('📤 Pushing local data to Supabase (first sync)');
            await saveToSupabase();
        }
    }

    [catRes, inputRes, groupRes, calcRes].forEach((res, i) => {
        const names = ['categories', 'input_definitions', 'input_groups', 'calculators'];
        if (res.error) console.error(`❌ ${names[i]} load error:`, res.error.message);
    });
}

/**
 * Auto-save on store changes (debounced 2s).
 */
function startAutoSave(): () => void {
    const unsub = storeRef.subscribe(() => {
        if (isSyncingFromRemote) return;
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => { saveToSupabase(); }, 2000);
    });

    return () => {
        unsub();
        if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
    };
}

// ── Debounced Realtime reload ──

const reloadDebounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function debouncedReloadTable(table: string) {
    if (reloadDebounceTimers[table]) clearTimeout(reloadDebounceTimers[table]);
    reloadDebounceTimers[table] = setTimeout(() => {
        reloadTable(table);
    }, 800);
}

/**
 * Listen to Realtime changes on ALL 4 tables for cross-device sync.
 */
function startRealtimeSync(): () => void {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);

    realtimeChannel = supabase
        .channel('calc-sync-v2')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
            if (!isSyncingFromRemote) debouncedReloadTable('categories');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'input_definitions' }, () => {
            if (!isSyncingFromRemote) debouncedReloadTable('input_definitions');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'input_groups' }, () => {
            if (!isSyncingFromRemote) debouncedReloadTable('input_groups');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'calculators' }, () => {
            if (!isSyncingFromRemote) debouncedReloadTable('calculators');
        })
        .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
                console.log('📡 Realtime sync active on all 4 tables');
            }
        });

    return () => {
        if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
    };
}

// Reload a single table from Supabase
async function reloadTable(table: string) {
    if (!storeRef) return;
    isSyncingFromRemote = true;
    const { data, error } = await supabase.from(table).select('*').order(table === 'calculators' ? 'name' : 'sort_order');
    if (error) { console.error(`❌ Reload ${table} failed:`, error.message); isSyncingFromRemote = false; return; }

    const storeUpdate: any = {};
    switch (table) {
        case 'categories': storeUpdate.categories = (data || []).map(rowToCategory); break;
        case 'input_definitions': storeUpdate.inputDefinitions = (data || []).map(rowToInputDef); break;
        case 'input_groups': storeUpdate.inputGroups = (data || []).map(rowToInputGroup); break;
        case 'calculators': storeUpdate.calculators = (data || []).map(rowToCalculator); break;
    }
    storeRef.setState(storeUpdate);

    setTimeout(() => { isSyncingFromRemote = false; }, 500);
}

// ── Main init ──

let initialized = false;

export async function initSupabaseSync(store: any) {
    if (initialized) return;
    initialized = true;

    storeRef = store;

    console.log('🚀 Initializing Supabase sync (4 tables)...');
    await loadFromSupabase();
    startAutoSave();
    startRealtimeSync();
    console.log('✅ Supabase sync initialized — all devices will stay in sync');
}
