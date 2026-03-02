import { world, system } from '@minecraft/server';
import { CLANS } from '../clans/clans_config.js';
import { isInClanBase } from './protection.js';
import { getPlayerScore, addPlayerScore } from './utils.js';

// Importar Handlers Modulares
import { handleRedCombat, handleRedDamageImmunity } from '../clans/red_clan.js';
import { handleBlueCombat, handleBlueDamageImmunity } from '../clans/blue_clan.js';
import { handleGreenCombat, handleGreenDamageImmunity } from '../clans/green_clan.js';
import { handleYellowDamageImmunity } from '../clans/yellow_clan.js';
import { handleStaffCombat } from '../clans/staff_clan.js';

// Rastrear último atacante de cada jogador
const lastAttacker = new Map();

// Detectar quando um player ataca outro (para friendly fire)
world.afterEvents.entityHitEntity.subscribe((event) => {
    const attacker = event.damagingEntity;
    const victim = event.hitEntity;
    if (attacker?.typeId === 'minecraft:player' && victim?.typeId === 'minecraft:player') {
        lastAttacker.set(victim.id, attacker);
        system.runTimeout(() => { lastAttacker.delete(victim.id); }, 20);
    }
});

// Cancelamento de Danos e Imunidades (beforeEvents)
const damageNotifier = world.beforeEvents.entityDamage || world.beforeEvents.entityHurt;

if (damageNotifier) {
    damageNotifier.subscribe((event) => {
        const victim = event.entity || event.hurtEntity;
        let damager = event.damageSource.damagingEntity;

        if (!victim) return;

        // ⚪ STAFF: Imortal
        if (victim.typeId === 'minecraft:player' && victim.hasTag(CLANS.staff.tag)) {
            event.cancel = true; return;
        }

        // ⚪ STAFF: Delega lógica de dano para o módulo
        if (damager && damager.hasTag(CLANS.staff.tag)) {
            handleStaffCombat(damager, victim, event);
            if (event.cancel) return;
        }

        // Proteger totem de dano
        if (victim.hasTag('totem_npc')) { event.cancel = true; return; }

        if (!damager && victim.typeId === 'minecraft:player') {
            damager = lastAttacker.get(victim.id);
        }

        // 🛡️ IMUNIDADES DE CLÃ (Delega para os módulos)
        if (victim.typeId === 'minecraft:player') {
            if (handleRedDamageImmunity(victim, event)) return;
            if (handleBlueDamageImmunity(victim, event)) return;
            if (handleGreenDamageImmunity(victim, event)) return;
            if (handleYellowDamageImmunity(victim, event)) return;
        }

        // ⚔️ HABILIDADES DE COMBATE (Ao Atacar)
        if (damager?.typeId === 'minecraft:player') {
            handleRedCombat(damager, victim);
            handleBlueCombat(damager, victim);
            handleGreenCombat(damager, victim);
        }


        // 🤝 FRIENDLY FIRE (Mesmo Clã)
        // Impedir que membros do mesmo clã se ataquem em qualquer lugar (inclusive bases)
        if (victim?.typeId === 'minecraft:player' && damager?.typeId === 'minecraft:player') {
            for (const key in CLANS) {
                if (victim.hasTag(CLANS[key].tag) && damager.hasTag(CLANS[key].tag)) {
                    event.cancel = true;
                    return;
                }
            }
        }
    });
}

// Contador de abates
world.afterEvents.entityDie.subscribe((event) => {
    const victim = event.deadEntity;
    const damager = event.damageSource.damagingEntity;
    if (victim.typeId === 'minecraft:player' && damager?.typeId === 'minecraft:player') {
        try {
            const currentKills = getPlayerScore(damager, 'player_kills') ?? 0;
            if (addPlayerScore(damager, 'player_kills', 1)) {
                damager.sendMessage(`§a[COMBATE] Voce abateu ${victim.name}! Total: ${currentKills + 1}`);
            }
        } catch (e) { }
    }
});

