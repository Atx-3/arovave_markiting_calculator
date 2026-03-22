/**
 * Supabase Sync — Single Blob Approach (v5)
 * 
 * ALL data stored in ONE row of the `app_state` table.
 * - Save = UPDATE the singleton row (no deletes ever)
 * - Load = SELECT the singleton row
 * - Realtime = listen for changes to `app_state`
 * 
 * v5 fixes:
 * - Supabase is ALWAYS source of truth (localStorage is just offline cache)
 * - Adds `syncReady` flag so UI can show loading state
 * - Adds retry logic for failed loads
 * - Adds `forceSave()` for immediate flush
 * - Reduced self-save block window
 * - Checks `supabaseReady` before any operations
 */

import { supabase, supabaseReady } from '../lib/supabase';

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
    if (isSyncingFromRemote || !storeRef || !supabaseReady) return;

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

    // Clear any pending debounce timer — we just saved
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }

    // Block Realtime self-reload for 1.5 seconds (reduced from 3s)
    setTimeout(() => { isSavingToRemote = false; }, 1500);
}

/**
 * Load state from the singleton app_state row.
 * Supabase is ALWAYS the source of truth — overwrites localStorage.
 * Includes retry logic for transient failures.
 */
async function loadFromSupabase(retries = 3): Promise<boolean> {
    if (!storeRef || !supabaseReady) {
        // No Supabase credentials — mark as ready with local data only
        if (storeRef) {
            storeRef.setState({ syncReady: true });
        }
        return false;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        const { data, error } = await supabase
            .from('app_state')
            .select('*')
            .eq('id', 'singleton')
            .single();

        if (error) {
            console.error(`❌ Load from Supabase failed (attempt ${attempt}/${retries}):`, error.message);
            if (attempt < retries) {
                // Wait before retry (exponential backoff: 500ms, 1000ms, 2000ms)
                await new Promise(r => setTimeout(r, 500 * attempt));
                continue;
            }
            // All retries exhausted — use local data
            console.warn('⚠️ All Supabase load attempts failed. Using local cache.');
            storeRef.setState({ syncReady: true });
            return false;
        }

        if (!data) {
            console.log('ℹ️ No data in app_state yet');
            // Supabase is empty — push local data up if we have any
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
            storeRef.setState({ syncReady: true });
            return true;
        }

        // ── We have remote data — it ALWAYS wins over localStorage ──
        const remoteCats = data.categories || [];
        const remoteInputs = data.input_definitions || [];
        const remoteGroups = data.input_groups || [];
        const remoteCalcs = data.calculators || [];

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
            syncReady: true,
        });

        setTimeout(() => { isSyncingFromRemote = false; }, 1000);
        return true;
    }

    storeRef.setState({ syncReady: true });
    return false;
}

/**
 * Auto-save on store changes (debounced 2s).
 */
function startAutoSave(): () => void {
    if (!supabaseReady) return () => {};

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

/**
 * Realtime: listen for changes to the app_state table.
 * Only reloads if the change came from another device (not our own save).
 */
function startRealtimeSync(): () => void {
    if (!supabaseReady) return () => {};
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);

    realtimeChannel = supabase
        .channel('app-state-sync')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_state' }, () => {
            // Only reload if WE didn't just save (prevents self-overwrite)
            if (!isSyncingFromRemote && !isSavingToRemote) {
                console.log('📡 Remote change detected, reloading...');
                loadFromSupabase(1); // Single attempt for realtime — don't retry aggressively
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

/**
 * Force-save: immediately flush any pending changes to Supabase.
 * Useful when navigating away from admin panel or before generating quotes.
 */
export async function forceSave() {
    if (!storeRef || !supabaseReady) return;
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    await saveToSupabase();
}

// ── Main init ──

let initialized = false;

export async function initSupabaseSync(store: any) {
    if (initialized) return;
    initialized = true;

    storeRef = store;

    if (!supabaseReady) {
        console.warn('⚠️ Supabase not configured — running in offline mode');
        store.setState({ syncReady: true });
        return;
    }

    console.log('🚀 Initializing Supabase sync (single blob)...');
    await loadFromSupabase();
    startAutoSave();
    startRealtimeSync();
    console.log('✅ Supabase sync initialized');
}
