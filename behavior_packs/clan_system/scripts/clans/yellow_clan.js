import { world, system, ItemStack } from '@minecraft/server';
import { CLANS } from './clans_config.js';

// ============================================================
// NAÇÃO DO VENTO (YELLOW) — Classes e Habilidades
// ============================================================
//
// Tags de Classe:
//   yellow_nativo     → Classe de entrada (sem bônus extra)
//   yellow_guerreiro  → Caçador do Céu (combate no ar)
//   yellow_construtor → Engenheiro do Vento (construção rápida)
//   clan_king         → Rei (com tag clan_yellow)
//
// Habilidade Nativa (TODOS): Imunidade a Queda + Haste I
// ============================================================

// Aplica efeitos passivos do clã Yellow e de suas classes
export function applyYellowEffects(player) {
    if (!player || !player.isValid) return;
    if (!player.hasTag(CLANS.yellow.tag)) return;

    try {
        // --- HABILIDADE NATIVA: Éter (Todos) ---
        player.addEffect('speed', 600, { amplifier: 0, showParticles: false }); // Velocidade I Nativa
        // Imunidade à queda é tratada em handleYellowDamageImmunity

        // --- CLASSE: CAÇADOR DO CÉU (Guerreiro) ---
        // Evolução da velocidade nativa + Salto II
        if (player.hasTag('yellow_guerreiro')) {
            player.addEffect('speed', 300, { amplifier: 1, showParticles: false });     // Velocidade II
            player.addEffect('jump_boost', 300, { amplifier: 1, showParticles: false }); // Salto II
        }

        // --- CLASSE: ENGENHEIRO DO VENTO (Construtor) ---
        // Balanceamento: Reduzir Haste IV para Haste III
        if (player.hasTag('yellow_construtor')) {
            player.addEffect('haste', 600, { amplifier: 2, showParticles: false }); // Haste III (era IV)
        }

        // --- CLASSE: REI ---
        // Aura Real: Resistência II + Velocidade II para aliados próximos
        if (player.hasTag('clan_king') && player.hasTag(CLANS.yellow.tag)) {
            try {
                const allies = world.getAllPlayers().filter(p =>
                    p.hasTag(CLANS.yellow.tag) && p.id !== player.id
                );
                for (const ally of allies) {
                    const dist = Math.sqrt(
                        (ally.location.x - player.location.x) ** 2 +
                        (ally.location.z - player.location.z) ** 2
                    );
                    if (dist <= 20) {
                        ally.addEffect('resistance', 300, { amplifier: 1, showParticles: true }); // Resis II
                        ally.addEffect('speed', 300, { amplifier: 1, showParticles: true });      // Velocidade II
                    }
                }
            } catch (e) { }
        }
    } catch (e) {
        // Silenciosamente ignora erros de efeitos inválidos
    }
}



// Bênçãos do Totem Yellow (base)
export function applyYellowTotemBlessings(player) {
    player.addEffect('regeneration', 300, { amplifier: 1, showParticles: true }); // Regen II
}


// Habilidade de Combate: Rajada de Vento (empurrar inimigo)
export function handleYellowCombat(damager, victim) {
    if (!damager.hasTag(CLANS.yellow.tag)) return;

    // Guerreiro do Vento: 25% de chance de empurrar inimigo para o ar
    if (damager.hasTag('yellow_guerreiro')) {
        if (Math.random() < 0.25) {
            try {
                // Aplicar knockback e lentidão de queda (simula arremesso)
                victim.applyKnockback(
                    damager.getViewDirection().x,
                    damager.getViewDirection().z,
                    2.0, // força horizontal
                    0.8  // força vertical
                );
                system.run(() => {
                    try {
                        damager.onScreenDisplay.setActionBar('§e💨 RAJADA DE VENTO! §7Inimigo arremessado.');
                    } catch (e) { }
                });
            } catch (e) { }
        }
    }
}

// Imunidades e Esquiva (O Fantasma)
export function handleYellowDamageImmunity(player, event) {
    if (!player.hasTag(CLANS.yellow.tag)) return false;

    // --- CLASSE: CAÇADOR DO CÉU (Esquiva Passiva) ---
    if (player.hasTag('yellow_guerreiro')) {
        // 15% de chance de desviar do golpe (voto do vento)
        if (Math.random() < 0.15) {
            event.cancel = true;
            system.run(() => {
                try {
                    player.addEffect('speed', 40, { amplifier: 1, showParticles: true }); // Velocidade II por 2s
                    player.onScreenDisplay.setActionBar('§e💨 ESQUIVA FANTASMA! §7Dano anulado.');
                } catch (e) { }
            });
            return true;
        }
    }

    if (event.damageSource.cause === 'fall') {
        event.cancel = true;
        return true;
    }
    return false;
}


// Habilidade: Alcance do Vento (Reach +3)
export function handleYellowBreakBlock(player, block, dimension) {
    if (!player.hasTag('yellow_construtor')) return false;

    // Nota: O alcance estendido é simulado via visual
    system.run(() => {
        try {
            player.onScreenDisplay.setActionBar('§e💨 ALCANCE DO VENTO! §7Construindo de longe.');
        } catch (e) { }
    });
    return true;
}

export const YELLOW_CLASSES = {
    nativo: { tag: 'yellow_nativo', name: 'Nativo', description: 'Classe de entrada da Nação do Vento.' },
    guerreiro: { tag: 'yellow_guerreiro', name: 'Caçador do Céu', description: 'Velocidade II + Salto II + Rajada de Vento.' },
    construtor: { tag: 'yellow_construtor', name: 'Engenheiro de Nuvens', description: 'Haste IV + Alcance do Vento (+3).' },
    rei: { tag: 'clan_king', name: 'Rei', description: 'Aura Real: Resistência II + Velocidade II para aliados.' },
};
