import { world, system } from '@minecraft/server';
import { CLANS, CLAN_BASE_RADIUS } from '../clans/clans_config.js';
import { isInBase } from './protection.js';

// Estado dos territórios por jogador (clanKey ou null)
export const playerBaseState = new Map();

// Alerta de entrada/saída de bases (roda a cada 1 segundo via protection.js)
// Esta função é chamada pelo loop de protection.js
export function checkTerritoryAlerts(player, currentBaseKey) {
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

// Determina em qual base o player está atualmente (retorna clanKey ou null)
export function getCurrentBaseKey(player) {
    for (const clanKey in CLANS) {
        if (clanKey === 'default') continue;
        const clan = CLANS[clanKey];
        const radius = clan.overrideRadius || CLAN_BASE_RADIUS;
        if (isInBase(player, clan.base, clan.dimension || 'overworld', radius)) {
            return clanKey;
        }
    }
    return null;
}
