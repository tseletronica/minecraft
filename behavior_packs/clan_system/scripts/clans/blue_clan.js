import { world, system, ItemStack } from '@minecraft/server';
import { CLANS } from './clans_config.js';

// ============================================================
// NAÇÃO DA ÁGUA (BLUE) — Classes e Habilidades
// ============================================================
//
// Tags de Classe:
//   blue_nativo     → Classe de entrada (sem bônus extra)
//   blue_guerreiro  → Guerreiro das Profundezas (combate aquático)
//   blue_construtor → Construtor (Haste + Fortuna aquática)
//   clan_king       → Rei (com tag clan_blue)
//
// Habilidade Nativa (TODOS): Respiração Aquática + Visão noturna na água + Imunidade a afogamento
// ============================================================

// Aplica efeitos passivos do clã Blue e de suas classes
export function applyBlueEffects(player) {
    if (!player || !player.isValid) return;
    if (!player.hasTag(CLANS.blue.tag)) return;

    try {
        // --- HABILIDADE NATIVA: Adaptação Aquática (Todos) ---
        player.addEffect('water_breathing', 600, { showParticles: false });
        player.addEffect('dolphins_grace', 600, { amplifier: 0, showParticles: false }); // Nado rápido nativo
        player.addEffect('conduit_power', 600, { amplifier: 0, showParticles: false }); // Visão clara embaixo d'água
        
        // Visão noturna embaixo d'água para melhor visualização
        if (player.isInWater) {
            player.addEffect('night_vision', 600, { amplifier: 0, showParticles: false });
        }

        // --- CLASSE: GUERREIRO DAS PROFUNDEZAS ---
        // Velocidade e força na água
        if (player.hasTag('blue_guerreiro')) {
            if (player.isInWater) {
                player.addEffect('speed', 300, { amplifier: 1, showParticles: false });  // Velocidade II na água
                player.addEffect('strength', 300, { amplifier: 0, showParticles: false }); // Força I na água
            }
        }

        // --- CLASSE: CONSTRUTOR ---
        // Haste II permanente / Haste III na água
        if (player.hasTag('blue_construtor')) {
            const amplifier = player.isInWater ? 2 : 1;
            player.addEffect('haste', 600, { amplifier: amplifier, showParticles: false });
        }

        // --- CLASSE: REI ---
        // Aura Real: Resistência II + Regeneração II para aliados próximos
        if (player.hasTag('clan_king') && player.hasTag(CLANS.blue.tag)) {
            try {
                const allies = world.getAllPlayers().filter(p =>
                    p.hasTag(CLANS.blue.tag) && p.id !== player.id
                );
                for (const ally of allies) {
                    const dist = Math.sqrt(
                        (ally.location.x - player.location.x) ** 2 +
                        (ally.location.z - player.location.z) ** 2
                    );
                    if (dist <= 20) {
                        ally.addEffect('resistance', 300, { amplifier: 1, showParticles: true });  // Resis II
                        ally.addEffect('regeneration', 300, { amplifier: 1, showParticles: true }); // Regen II
                        ally.addEffect('water_breathing', 300, { showParticles: false });
                    }
                }
            } catch (e) { }
        }
    } catch (e) {
        // Silenciosamente ignora erros de efeitos inválidos
    }
}



// Bênçãos do Totem Blue (base)
export function applyBlueTotemBlessings(player) {
    player.addEffect('regeneration', 300, { amplifier: 1, showParticles: true }); // Regen II
}


// Habilidade de Combate: Onda de Choque e Arpão (Dominador)
export function handleBlueCombat(damager, victim) {
    if (!damager.hasTag(CLANS.blue.tag)) return;

    // --- CLASSE: GUERREIRO DAS ÁGUAS (Dominador) ---
    if (damager.hasTag('blue_guerreiro')) {
        const chance = Math.random();

        // 1. Arpão: 25% de chance de PUXAR em vez de empurrar
        if (chance < 0.25) {
            try {
                const dir = damager.getViewDirection();
                // Knockback negativo = puxar
                victim.applyKnockback(-dir.x, -dir.z, 1.5, 0.2);
                system.run(() => {
                    try {
                        damager.onScreenDisplay.setActionBar('§9⚓ ARPÃO! §7Inimigo puxado.');
                    } catch (e) { }
                });
            } catch (e) { }
        }

        // 2. Onda de Choque: 25% de chance de Lentidão e Fraqueza
        if (chance >= 0.25 && chance < 0.50) {
            system.run(() => {
                try {
                    victim.addEffect('slowness', 60, { amplifier: 1, showParticles: true });
                    if (victim.isInWater || damager.isInWater) {
                        victim.addEffect('weakness', 100, { amplifier: 1, showParticles: true }); // Fraqueza II na água
                        damager.onScreenDisplay.setActionBar('§9🌊 DOMÍNIO AQUÁTICO! §7Inimigo enfraquecido.');
                    } else {
                        damager.onScreenDisplay.setActionBar('§9🌊 ONDA DE CHOQUE! §7Inimigo atordoado.');
                    }
                } catch (e) { }
            });
        }
        return;
    }

    // Nativo/Rei/Construtor: 15% de chance de lentidão simples
    if (Math.random() < 0.15) {
        victim.addEffect('slowness', 40, { amplifier: 0, showParticles: true });
    }
}


// Imunidade: Afogamento
export function handleBlueDamageImmunity(player, event) {
    if (!player.hasTag(CLANS.blue.tag)) return false;
    if (event.damageSource.cause === 'drowning') {
        event.cancel = true;
        return true;
    }
    return false;
}

// Habilidade: Coletor das Marés (Itens direto pro inv)
export function handleBlueBreakBlock(player, block, dimension) {
    if (!player.hasTag('blue_construtor')) return false;

    // Envia mensagem de feedback
    player.onScreenDisplay.setActionBar('§9💧 COLETOR DAS MARÉS! §7Itens coletados.');

    // Devolvemos true para indicar que a habilidade foi ativada.
    // A lógica de coleta direta será centralizada no main.js para maior controle.
    return true;
}

export const BLUE_CLASSES = {
    nativo: { tag: 'blue_nativo', name: 'Nativo', description: 'Classe de entrada da Nação da Água.' },
    guerreiro: { tag: 'blue_guerreiro', name: 'Guerreiro das Águas', description: 'Velocidade II na água + Onda de Choque.' },
    construtor: { tag: 'blue_construtor', name: 'Construtor das Marés', description: 'Haste III na água + Coleta Direta pro Inv.' },
    rei: { tag: 'clan_king', name: 'Rei', description: 'Aura Real: Resistência II + Regen II para aliados.' },
};
