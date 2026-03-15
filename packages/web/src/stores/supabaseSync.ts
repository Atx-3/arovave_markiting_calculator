/**
 * Supabase Sync — Single Blob Approach (v4)
 * 
 * ALL data stored in ONE row of the `app_state` table.
 * - Save = UPDATE the singleton row (no deletes ever)
 * - Load = SELECT the singleton row
 * - Realtime = listen for changes to `app_state`
 * 
 * This eliminates all multi-table, multi-row, delete-based bugs.
 */

import { supabase } from '../lib/supabase';

// ── Store reference ──
let storeRef: any = null;

// ── State ──
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let isSyncingFromRemote = false;
let isSavingToRemote = false;

/**
 * Save entire state to the singleton app_state row.
 * Just one UPDATE — no deletes, no multi-table, no complexity.
 */
async function saveToSupabase() {
    if (isSyncingFromRemote || !storeRef) return;

    isSavingToRemote = true;
    const state = storeRef.getState();

    const payload = {
        categories: state.categories || [],
        input_definitions: state.inputDefinitions || [],
        input_groups: state.inputGroups || [],
        calculators: state.calculators || [],
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
        .from('app_state')
        .update(payload)
        .eq('id', 'singleton');

    if (error) {
        console.error('❌ Save to Supabase failed:', error.message);
        // If update fails (row doesn't exist), try upsert
        const { error: upsertErr } = await supabase
            .from('app_state')
            .upsert({ id: 'singleton', ...payload });
        if (upsertErr) {
            console.error('❌ Upsert fallback also failed:', upsertErr.message);
        } else {
            console.log('✅ Data saved to Supabase (upsert fallback)');
        }
    } else {
        console.log('✅ Data saved to Supabase');
    }

    // Block Realtime self-reload for 3 seconds
    setTimeout(() => { isSavingToRemote = false; }, 3000);
}

/**
 * Load state from the singleton app_state row.
 */
async function loadFromSupabase() {
    if (!storeRef) return;

    const { data, error } = await supabase
        .from('app_state')
        .select('*')
        .eq('id', 'singleton')
        .single();

    if (error) {
        console.error('❌ Load from Supabase failed:', error.message);
        return;
    }

    if (!data) {
        console.log('ℹ️ No data in app_state yet');
        return;
    }

    const remoteCats = data.categories || [];
    const remoteInputs = data.input_definitions || [];
    const remoteGroups = data.input_groups || [];
    const remoteCalcs = data.calculators || [];

    const hasRemoteData =
        remoteCats.length > 0 ||
        remoteInputs.length > 0 ||
        remoteCalcs.length > 0;

    if (hasRemoteData) {
        console.log(`📦 Loaded from Supabase: ${remoteCats.length} categories, ${remoteInputs.length} inputs, ${remoteCalcs.length} calculators`);
        isSyncingFromRemote = true;

        // Clean up orphaned charges (charges whose parent calculator was deleted)
        const mainCalcIds = new Set(remoteCalcs.filter((c: any) => !c.isCharge).map((c: any) => c.id));
        const cleanedCalcs = remoteCalcs.filter((c: any) => !c.isCharge || (c.parentCalcId && mainCalcIds.has(c.parentCalcId)));
        if (cleanedCalcs.length !== remoteCalcs.length) {
            console.log(`🧹 Cleaned up ${remoteCalcs.length - cleanedCalcs.length} orphaned charge(s)`);
        }

        storeRef.setState({
            categories: remoteCats,
            inputDefinitions: remoteInputs,
            inputGroups: remoteGroups,
            calculators: cleanedCalcs,
        });

        setTimeout(() => { isSyncingFromRemote = false; }, 1000);
    } else {
        // Supabase is empty — push local data up
        const state = storeRef.getState();
        const hasLocalData =
            state.categories.length > 0 ||
            state.inputDefinitions.length > 0 ||
            state.calculators.length > 0;

        if (hasLocalData) {
            console.log('📤 Supabase empty, pushing local data...');
            await saveToSupabase();
        } else {
            console.log('ℹ️ Both Supabase and local store are empty');
        }
    }
}

/**
 * Auto-save on store changes (debounced 3s).
 */
function startAutoSave(): () => void {
    const unsub = storeRef.subscribe(() => {
        if (isSyncingFromRemote) return;
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => { saveToSupabase(); }, 3000);
    });

    return () => {
        unsub();
        if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
    };
}

/**
 * Realtime: listen for changes to the app_state table.
 * Only reloads if the change came from another device (not our own save).
 */
function startRealtimeSync(): () => void {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);

    realtimeChannel = supabase
        .channel('app-state-sync')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_state' }, () => {
            // Only reload if WE didn't just save (prevents self-overwrite)
            if (!isSyncingFromRemote && !isSavingToRemote) {
                console.log('📡 Remote change detected, reloading...');
                loadFromSupabase();
            }
        })
        .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
                console.log('📡 Realtime sync active on app_state');
            }
        });

    return () => {
        if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
    };
}

// ── Main init ──

let initialized = false;

export async function initSupabaseSync(store: any) {
    if (initialized) return;
    initialized = true;

    storeRef = store;

    console.log('🚀 Initializing Supabase sync (single blob)...');
    await loadFromSupabase();
    startAutoSave();
    startRealtimeSync();
    console.log('✅ Supabase sync initialized');
}
