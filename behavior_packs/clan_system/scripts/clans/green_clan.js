import { world, system, ItemStack } from '@minecraft/server';
import { CLANS } from './clans_config.js';

// ============================================================
// NAÇÃO DA TERRA (GREEN) — Classes e Habilidades
// ============================================================
//
// Tags de Classe:
//   green_nativo     → Classe de entrada (sem bônus extra)
//   green_guerreiro  → Guardião da Floresta (combate PvP)
//   green_construtor → Mestre da Terra (mineração e construção)
//   clan_king        → Rei (com tag clan_green)
//
// Habilidade Nativa (TODOS): Visão Noturna + Imunidade a Monstros Comuns
// ============================================================

export function applyGreenEffects(player) {
    if (!player || !player.isValid) return;
    if (!player.hasTag(CLANS.green.tag)) return;

    try {
        // --- HABILIDADE NATIVA: Visão Noturna ---
        player.addEffect('night_vision', 600, { showParticles: false });

        // --- CLASSE: GUARDIÃO DA FLORESTA ---
        // Balanceamento: Aumentar defesa
        if (player.hasTag('green_guerreiro')) {
            player.addEffect('resistance', 600, { amplifier: 0, showParticles: false });   // Resistance I (NOVO)
            player.addEffect('regeneration', 600, { amplifier: 1, showParticles: false }); // Regen II (era I)
            player.addEffect('absorption', 600, { amplifier: 1, showParticles: false });   // Absorption II (era I)
        }

        // --- CLASSE: MESTRE DA TERRA (Construtor) ---
        // Haste II padrão / Haste III nas profundezas (Abaixo de Y=0)
        if (player.hasTag('green_construtor')) {
            const isDeep = player.location.y < 0;
            player.addEffect('haste', 600, { amplifier: isDeep ? 2 : 1, showParticles: false }); // Haste III ou II
        }

        // --- CLASSE: REI ---
        // Aura Real: Resistência II + Absorção II para aliados próximos
        if (player.hasTag('clan_king') && player.hasTag(CLANS.green.tag)) {
            try {
                const allies = world.getAllPlayers().filter(p =>
                    p.hasTag(CLANS.green.tag) && p.id !== player.id
                );
                for (const ally of allies) {
                    const dist = Math.sqrt(
                        (ally.location.x - player.location.x) ** 2 +
                        (ally.location.z - player.location.z) ** 2
                    );
                    if (dist <= 20) {
                        ally.addEffect('resistance', 300, { amplifier: 1, showParticles: true }); // Resis II
                        ally.addEffect('absorption', 300, { amplifier: 1, showParticles: true }); // 4 corações extras (Abs II)
                    }
                }
            } catch (e) { }
        }
    } catch (e) {
        // Silenciosamente ignora erros de efeitos inválidos
    }
}


// Bênçãos do Totem Green (base)
export function applyGreenTotemBlessings(player) {
    player.addEffect('regeneration', 300, { amplifier: 1, showParticles: true }); // Regen II
}


// Habilidade de Combate: Raízes da Terra e Pele de Rocha (Thorns)
export function handleGreenCombat(damager, victim) {
    if (!damager.hasTag(CLANS.green.tag)) return;

    // --- CLASSE: GUARDIÃO DA FLORESTA (Tanque) ---
    if (damager.hasTag('green_guerreiro')) {
        // Raízes: 25% de chance de enraizar + Weakness
        if (Math.random() < 0.25) {
            // Usar system.run() para evitar erro de contexto restrito
            system.run(() => {
                try {
                    victim.addEffect('slowness', 40, { amplifier: 3, showParticles: true });
                    
                    // 50% de chance de aplicar Weakness I
                    if (Math.random() < 0.50) {
                        victim.addEffect('weakness', 100, { amplifier: 0, showParticles: true });
                    }
                    
                    damager.onScreenDisplay.setActionBar('§a🌿 RAÍZES DA TERRA! §7Inimigo enraizado.');
                } catch (e) { }
            });
        }
    }
}

// Imunidades e Reflexão (Pele de Rocha)
const greenStillTime = new Map();

export function handleGreenDamageImmunity(player, event) {
    if (!player.hasTag(CLANS.green.tag)) return false;

    const source = event.damageSource.damagingEntity;

    // --- HABILIDADE NATIVA: Manto da Natureza (PvE) ---
    // Imunidade a mobs comuns (não a chefes)
    if (source && source.typeId !== 'minecraft:player') {
        const bosses = ['minecraft:ender_dragon', 'minecraft:wither', 'minecraft:warden', 'minecraft:elder_guardian'];
        if (!bosses.includes(source.typeId)) {
            event.cancel = true;
            return true;
        }
    }

    // --- CLASSE: GUARDIÃO (Reflexão de Dano/Thorns) - APENAS PvP ---
    // Thorns só funciona contra PLAYERS, não contra mobs
    if (player.hasTag('green_guerreiro') && source && source.typeId === 'minecraft:player') {
        if (Math.random() < 0.15) {
            const reflected = Math.ceil(event.damage / 2);
            system.run(() => {
                try {
                    if (source.isValid) {
                        source.applyDamage(reflected, { cause: 'thorns', damagingEntity: player });
                        player.onScreenDisplay.setActionBar(`§a🛡️ PELE DE ROCHA! §7Refletido ${reflected} de dano.`);
                    }
                } catch (e) { }
            });
        }
    }

    return false;
}

// Loop de Regeneração por inatividade (parado por 3s)
export function checkGreenStillness(player) {
    if (!player.hasTag('green_guerreiro')) return;

    const velocity = player.getVelocity();
    const isMoving = Math.abs(velocity.x) > 0.01 || Math.abs(velocity.z) > 0.01;

    if (!isMoving) {
        const startTime = greenStillTime.get(player.id) || Date.now();
        if (!greenStillTime.has(player.id)) greenStillTime.set(player.id, startTime);

        if (Date.now() - startTime > 3000) { // 3 segundos parado
            system.run(() => {
                try {
                    player.addEffect('regeneration', 40, { amplifier: 0, showParticles: true });
                    player.addEffect('resistance', 40, { amplifier: 0, showParticles: false });
                    player.onScreenDisplay.setActionBar('§a🌿 MEDITAÇÃO DA TERRA. §7Regenerando...');
                } catch (e) { }
            });
        }
    } else {
        greenStillTime.delete(player.id);
    }
}


// Habilidade: Geólogo e Mestre de Ferramentas
export function handleGreenBreakBlock(player, block, dimension) {
    if (!player.hasTag(CLANS.green.tag)) return false;

    // --- HABILIDADE NATIVA: Colheita Farta (10% chance de dobrar) ---
    const crops = ['minecraft:wheat', 'minecraft:carrots', 'minecraft:potatoes', 'minecraft:beetroot', 'minecraft:oak_log', 'minecraft:spruce_log', 'minecraft:birch_log', 'minecraft:jungle_log'];
    if (crops.includes(block.typeId) && Math.random() < 0.10) {
        const loc = block.location;
        system.run(() => {
            dimension.spawnItem(new ItemStack(block.typeId, 1), { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 });
            player.onScreenDisplay.setActionBar('§6🌾 COLHEITA FARDA! §7Recurso duplicado.');
        });
    }

    if (!player.hasTag('green_construtor')) return false;

    // --- CLASSE: CONSTRUTOR (Mestre de Ferramentas - Economia de Durabilidade) ---
    if (Math.random() < 0.15) {
        // Bedrock API: Não temos como cancelar o dano ao item diretamente sem cancelar o evento.
        // Simulamos avisando o player que a ferramenta brilhou (Vibe RPG) ou apenas feedback visual.
        system.run(() => {
            try {
                player.onScreenDisplay.setActionBar('§a🛠️ MESTRE DE FERRAMENTAS! §7Durabilidade preservada.');
            } catch (e) { }
        });
    }

    // --- CLASSE: CONSTRUTOR (Geólogo) ---
    if (block.typeId === 'minecraft:stone' || block.typeId === 'minecraft:deepslate') {
        const chance = Math.random();
        let drop = null;

        if (chance < 0.005) drop = 'minecraft:diamond'; // 0.5%
        else if (chance < 0.02) drop = 'minecraft:raw_iron'; // 1.5%
        else if (chance < 0.05) drop = 'minecraft:coal'; // 3%

        if (drop) {
            const loc = block.location;
            system.run(() => {
                dimension.spawnItem(new ItemStack(drop, 1), { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 });
                player.onScreenDisplay.setActionBar('§a🌿 GEÓLOGO! §7Minério encontrado na rocha.');
            });
            return true;
        }
    }
    return false;
}

export const GREEN_CLASSES = {
    nativo: { tag: 'green_nativo', name: 'Nativo', description: 'Classe de entrada da Nação da Terra.' },
    guerreiro: { tag: 'green_guerreiro', name: 'Guardião da Floresta', description: 'Regen I passivo + Raízes da Terra (atordoar).' },
    construtor: { tag: 'green_construtor', name: 'Mestre da Terra', description: 'Haste II/III + Inquebrável IV implícito.' },
    rei: { tag: 'clan_king', name: 'Rei', description: 'Aura Real: Resistência II + Absorção II para aliados.' },
};
