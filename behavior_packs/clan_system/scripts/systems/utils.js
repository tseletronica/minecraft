import { world } from '@minecraft/server';
import { CLANS } from '../clans/clans_config.js';

// Verificação de Admin
export function checkAdmin(player) {
    if (!player) return false;
    try {
        const tags = player.getTags();
        const colorRegex = /§[0-9a-fk-or]/g;
        return tags.some(tag => {
            const cleanTag = tag.replace(colorRegex, '').toLowerCase();
            return cleanTag.includes('admin') || cleanTag.includes('op') || cleanTag === 'staff_adm' || cleanTag === 'staff_mod';
        });
    } catch (e) { return false; }
}

// Helper centralizado para obter scores de forma segura
export function getPlayerScore(player, objectiveId) {
    try {
        const obj = world.scoreboard.getObjective(objectiveId);
        if (!obj) return 0;

        const entityScore = obj.getScore(player);
        let maxScore = entityScore ?? 0;
        let foundAny = entityScore !== undefined;

        for (const p of obj.getParticipants()) {
            if (p.displayName === player.name && !p.getEntity()) {
                const s = obj.getScore(p);
                if (s !== undefined) {
                    maxScore = Math.max(maxScore, s);
                    foundAny = true;
                }
            }
        }

        return maxScore;
    } catch (e) {
        return 0;
    }
}

// Helper centralizado para adicionar scores de forma segura
export function addPlayerScore(player, objectiveId, amount) {
    try {
        const obj = world.scoreboard.getObjective(objectiveId);
        if (!obj) return false;

        let fragmentedScore = 0;
        for (const p of obj.getParticipants()) {
            if (p.displayName === player.name && !p.getEntity()) {
                fragmentedScore += (obj.getScore(p) || 0);
                try { obj.removeParticipant(p); } catch (e) { }
            }
        }

        const currentEntityScore = obj.getScore(player) || 0;
        obj.setScore(player, currentEntityScore + fragmentedScore + amount);

        return true;
    } catch (e) {
        try {
            const sign = amount >= 0 ? 'add' : 'remove';
            const val = Math.abs(amount);
            player.runCommand(`scoreboard players ${sign} @s ${objectiveId} ${val}`);
            return true;
        } catch (e2) { return false; }
    }
}

// Obter cargo do jogador baseado em abates ou tag de rei
export function getRank(player, clan) {
    // 1. STAFF
    if (player.hasTag(CLANS.staff.tag)) {
        if (player.hasTag('staff_adm')) return 'Administrador';
        if (player.hasTag('staff_mod')) return 'Moderador';
        if (player.hasTag('staff_knight')) return 'Cavaleiro';
        if (player.hasTag('staff_squire')) return 'Escudeiro';
        return 'Staff';
    }

    // 2. NÔMADE
    if (player.hasTag(CLANS.default.tag)) return 'Nomades';

    // 3. NAÇÕES (por abates)
    if (player.hasTag('clan_king')) return 'Rei';
    const kills = getPlayerScore(player, 'player_kills');
    if (kills >= 50) return 'Soldado';
    if (kills >= 20) return 'Recruta';

    return 'Membro';
}
