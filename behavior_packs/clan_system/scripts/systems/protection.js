import { world, system } from '@minecraft/server';
import { CLANS, CLAN_BASE_RADIUS } from '../clans/clans_config.js';
import { applyRedEffects, applyRedTotemBlessings } from '../clans/red_clan.js';
import { applyBlueEffects, applyBlueTotemBlessings } from '../clans/blue_clan.js';
import { applyGreenEffects, applyGreenTotemBlessings, checkGreenStillness } from '../clans/green_clan.js';
import { applyYellowEffects, applyYellowTotemBlessings } from '../clans/yellow_clan.js';
import { applyStaffEffects, applyStaffTotemBlessings } from '../clans/staff_clan.js';

// Estado dos jogadores para alertas de território
export const playerBaseState = new Map();
// Controle global para evitar múltiplos menus
export const activeMenus = new Set();
// Timer de lealdade do Escudeiro
export const squireTeleportTimers = new Map();

// Helper: verifica se player está dentro de uma base
export function isInBase(player, base, dimensionId, customRadius) {
    if (!player || !player.dimension) return false;
    const pDim = player.dimension.id.replace('minecraft:', '');
    const bDim = dimensionId.replace('minecraft:', '');
    if (pDim !== bDim) return false;
    const loc = player.location;
    const dist = Math.sqrt((loc.x - base.x) ** 2 + (loc.z - base.z) ** 2);
    const radius = customRadius || CLAN_BASE_RADIUS;
    return dist < radius;
}

// Helper: verifica se player está na base do clã por chave
export function isInClanBase(player, clanKey) {
    const clan = CLANS[clanKey];
    if (!clan) return false;
    const radius = clan.overrideRadius || CLAN_BASE_RADIUS;
    return isInBase(player, clan.base, clan.dimension || 'overworld', radius);
}

// ⚪ Loop de Efeitos e Estados (em vez de espalhar em main.js)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!player.hasTag('clan_selection_locked')) {
            // --- INTEGRIDADE DE TAGS (Garante apenas 1 clã) ---
            const currentTags = [];
            for (const key in CLANS) { if (player.hasTag(CLANS[key].tag)) currentTags.push(CLANS[key].tag); }

            if (currentTags.length > 1) {
                const priority = currentTags.find(t => t !== 'clan_black' && t !== 'clan_default') || currentTags[0];
                currentTags.forEach(t => { if (t !== priority) player.removeTag(t); });
            }

            // Delegar efeitos passivos + classes
            applyRedEffects(player);
            applyBlueEffects(player);
            applyGreenEffects(player);
            applyYellowEffects(player);
            checkGreenStillness(player); // Loop especial Earth

            if (player.hasTag(CLANS.staff.tag)) applyStaffEffects(player);

            // --- BÊNÇÃOS DO TOTEM ---
            let nearOwnTotem = false;
            let currentBaseKey = null;

            for (const clanKey in CLANS) {
                if (clanKey === 'default') continue;
                const clan = CLANS[clanKey];
                const radius = clan.overrideRadius || CLAN_BASE_RADIUS;
                const inThisBase = isInBase(player, clan.base, clan.dimension || 'overworld', radius);
                if (inThisBase) currentBaseKey = clanKey;

                if (player.hasTag(clan.tag) && inThisBase) {
                    nearOwnTotem = true;
                    switch (clanKey) {
                        case 'red': applyRedTotemBlessings(player); break;
                        case 'blue': applyBlueTotemBlessings(player); break;
                        case 'green': applyGreenTotemBlessings(player); break;
                        case 'yellow': applyYellowTotemBlessings(player); break;
                        case 'staff': applyStaffTotemBlessings(player); break;
                    }
                }
            }

            if (!nearOwnTotem) {
                const res = player.getEffect('resistance');
                if (res && res.amplifier >= 250) player.removeEffect('resistance');
            }

            // Alertas de Território
            const lastBaseKey = playerBaseState.get(player.id);
            if (currentBaseKey !== lastBaseKey) {
                if (currentBaseKey) {
                    const clan = CLANS[currentBaseKey];
                    player.onScreenDisplay.setActionBar(`§eEntrando no territorio da ${clan.color}${clan.name}`);
                } else if (lastBaseKey) {
                    player.onScreenDisplay.setActionBar(`§cSaindo de area protegida`);
                }
                playerBaseState.set(player.id, currentBaseKey);
            }
        }
    }
}, 20);

