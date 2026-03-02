import { world, system, ItemStack } from '@minecraft/server';
import { CLANS } from './clans_config.js';
import { getPlayerScore } from '../systems/utils.js';

// ============================================================
// NAÇÃO DO FOGO (RED) — Classes e Habilidades
// ============================================================
//
// Tags de Classe:
//   red_nativo     → Classe de entrada (sem bônus extra)
//   red_guerreiro  → Guerreiro (bônus de combate)
//   red_construtor → Construtor (bônus de mineração)
//   clan_king      → Rei (bônus de aura para aliados)
//
// Habilidade Nativa (TODOS): Imunidade ao Fogo
// ============================================================

// Aplica efeitos passivos do clã Red e de suas classes
export function applyRedEffects(player) {
    if (!player.hasTag(CLANS.red.tag)) return;

    // --- HABILIDADE NATIVA: Imunidade ao Fogo (Todos) ---
    player.addEffect('fire_resistance', 600, { showParticles: false });

    // --- CLASSE: GUERREIRO ---
    // Bônus passivo: Força I permanente
    if (player.hasTag('red_guerreiro')) {
        player.addEffect('strength', 600, { amplifier: 0, showParticles: false });
    }

    // --- CLASSE: CONSTRUTOR ---
    // Bônus passivo: Haste II (minera 2x mais rápido)
    if (player.hasTag('red_construtor')) {
        player.addEffect('haste', 600, { amplifier: 1, showParticles: false });
    }

    // --- CLASSE: REI ---
    // Aura Real: Resistência II + Força II para aliados próximos
    if (player.hasTag('clan_king') && player.hasTag(CLANS.red.tag)) {
        try {
            const allies = world.getAllPlayers().filter(p =>
                p.hasTag(CLANS.red.tag) && p.id !== player.id
            );
            for (const ally of allies) {
                const dist = Math.sqrt(
                    (ally.location.x - player.location.x) ** 2 +
                    (ally.location.z - player.location.z) ** 2
                );
                if (dist <= 20) {
                    ally.addEffect('resistance', 300, { amplifier: 1, showParticles: true }); // Resis II
                    ally.addEffect('strength', 300, { amplifier: 1, showParticles: true });   // Força II
                }
            }
        } catch (e) { }
    }
}


// Aplica bênçãos do Totem Red (quando na base)
export function applyRedTotemBlessings(player) {
    player.addEffect('regeneration', 300, { amplifier: 1, showParticles: true }); // Regen II

    // Rei na base: aura estendida para 30 blocos
    if (player.hasTag('clan_king')) {
        player.addEffect('strength', 300, { amplifier: 2, showParticles: true }); // Força III para o próprio Rei
    }
}

// Habilidade de Combate: Fúria de Magma (Berserker)
// Chame esta função no handler de dano
const redBerserkerCooldowns = new Map();

export function handleRedCombat(damager, victim) {
    if (!damager.hasTag(CLANS.red.tag)) return;

    // --- CLASSE: GUERREIRO (Berserker) ---
    if (damager.hasTag('red_guerreiro')) {
        const health = damager.getComponent('health');
        const maxHealth = health.effectiveMaxValue;
        const currentHealth = health.currentValue;

        // 1. Dano Extra por Vida Perdida (+1 a cada 4 HP perdidos)
        const damageIncr = Math.floor((maxHealth - currentHealth) / 4);
        if (damageIncr > 0) {
            victim.applyDamage(damageIncr, { cause: 'entityAttack', damagingEntity: damager });
            if (Math.random() < 0.2) damager.onScreenDisplay.setActionBar(`§c🔥 FÚRIA! §7+${damageIncr} de dano.`);
        }

        // 2. Chance de Incendiar (Sempre ativa para o guerreiro)
        if (Math.random() < 0.30) {
            victim.setOnFire(5);
        }

        // 3. Sobrevivência (Resistência II se vida < 6 HP)
        if (currentHealth <= 6) {
            const now = Date.now();
            const lastUse = redBerserkerCooldowns.get(damager.id) || 0;
            if (now - lastUse > 120000) { // 2 minutos de cooldown
                system.run(() => {
                    try {
                        damager.addEffect('resistance', 200, { amplifier: 1, showParticles: true }); // Resis II por 10s
                        damager.onScreenDisplay.setActionBar('§c🔥 ÚLTIMO SUSPIRO! §7Resistência II ativada.');
                    } catch (e) { }
                });
                redBerserkerCooldowns.set(damager.id, now);
            }
        }
        return;
    }

    // Nativo/Construtor/Rei: 15% de chance por 3 segundos
    if (Math.random() < 0.15) {
        victim.setOnFire(3);
        damager.onScreenDisplay.setActionBar('§c🔥 LÂMINA DE LABAREDA! §7Inimigo incendiado.');
    }
}


// Imunidades de Dano (Fogo e Lava)
export function handleRedDamageImmunity(player, event) {
    if (!player.hasTag(CLANS.red.tag)) return false;
    const FIRE_SOURCES = ['lava', 'magma', 'fire', 'fireTick', 'minecraft:lava'];
    if (event.damageSource.cause && FIRE_SOURCES.includes(event.damageSource.cause)) {
        event.cancel = true;
        return true;
    }
    return false;
}

// Habilidade de Mineração: Fornalha Viva (Auto-Smelt)
export function handleRedBreakBlock(player, block, dimension) {
    if (!player.hasTag('red_construtor')) return;

    const autoSmelt = {
        'minecraft:iron_ore': 'minecraft:iron_ingot',
        'minecraft:deepslate_iron_ore': 'minecraft:iron_ingot',
        'minecraft:gold_ore': 'minecraft:gold_ingot',
        'minecraft:deepslate_gold_ore': 'minecraft:gold_ingot',
        'minecraft:copper_ore': 'minecraft:copper_ingot',
        'minecraft:deepslate_copper_ore': 'minecraft:copper_ingot',
        'minecraft:raw_iron': 'minecraft:iron_ingot',
        'minecraft:raw_gold': 'minecraft:gold_ingot',
        'minecraft:raw_copper': 'minecraft:copper_ingot'
    };

    const smeltedId = autoSmelt[block.typeId];
    if (smeltedId) {
        const location = block.location;
        //system.run para evitar erros de delay de evento
        system.run(() => {
            dimension.spawnItem(new ItemStack(smeltedId, 1), { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 });
            player.onScreenDisplay.setActionBar('§c🔥 FORNALHA VIVA! §7Minério fundido.');
        });
        return true;
    }
    return false;
}

// Lista de classes disponíveis para futuros sistemas de promoção
export const RED_CLASSES = {
    nativo: { tag: 'red_nativo', name: 'Nativo', description: 'Classe de entrada da Nação do Fogo.' },
    guerreiro: { tag: 'red_guerreiro', name: 'Guerreiro', description: 'Lâmina de Labareda aprimorada + Força I passiva.' },
    construtor: { tag: 'red_construtor', name: 'Construtor', description: 'Haste II permanente + desconto de forja.' },
    rei: { tag: 'clan_king', name: 'Rei', description: 'Aura Real: Resistência II + Força II para aliados.' },
};
