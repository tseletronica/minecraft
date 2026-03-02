import { world, system } from '@minecraft/server';

// Definição das Classes Staff (Padronizadas + Escudeiro)
export const STAFF_CLASSES = {
    staff_guerreiro: {
        name: "Cavaleiro Staff",
        desc: "§7O braço forte da justiça. Protege os jogadores e pune infratores.",
        icon: "textures/ui/strength_effect"
    },
    staff_construtor: {
        name: "Arquiteto Staff",
        desc: "§7Mestre das estruturas. Responsável por construir e manter arenas e eventos.",
        icon: "textures/ui/hammer_icon"
    },
    staff_rei: {
        name: "Administrador / Rei",
        desc: "§7Poder total de gestão. Imortal e focado em manter a ordem soberana.",
        icon: "textures/ui/gear"
    },
    staff_squire: {
        name: "Escudeiro",
        desc: "§7Ajudante em treinamento. Pacífico e leal aos seus superiores.",
        icon: "textures/ui/resistance_effect"
    }
};

// Efeitos Passivos Contínuos
export function applyStaffEffects(player) {
    if (!player.hasTag('clan_black')) return;

    // ⚪ Todos os Staff são Imortais de Base (Resistência 255)
    const res = player.getEffect('resistance');
    if (!res || res.amplifier < 250) {
        player.addEffect('resistance', 600, { amplifier: 255, showParticles: false });
    }

    // ⚪ Especializações de Staff

    // Escudeiros são Pacifistas e possuem Lealdade
    if (player.hasTag('staff_squire')) {
        const weak = player.getEffect('weakness');
        if (!weak || weak.amplifier < 250) {
            player.addEffect('weakness', 600, { amplifier: 255, showParticles: false });
        }
        handleSquireLoyalty(player);
    } else {
        // Outras classes staff podem lutar se necessário (mas mantêm imortalidade)
        if (player.getEffect('weakness')) player.removeEffect('weakness');
    }

    // Construtores Staff têm Pressa Divina (Haste V) para obras rápidas
    if (player.hasTag('staff_construtor')) {
        player.addEffect('haste', 600, { amplifier: 4, showParticles: false });
    }
}

// Bênçãos do Totem na Base (Refúgio Staff)
export function applyStaffTotemBlessings(player) {
    player.addEffect('resistance', 300, { amplifier: 255, showParticles: false });
    player.addEffect('regeneration', 300, { amplifier: 2, showParticles: true }); // Regen III na base Staff
    player.addEffect('saturation', 300, { amplifier: 10, showParticles: false }); // Fome zero na base Staff
}

// Regras de Combate
export function handleStaffCombat(damager, victim, event) {
    if (!damager.hasTag('clan_staff')) return;

    // Escudeiro não ataca ninguém (vítima player)
    if (damager.hasTag('staff_squire') && victim.typeId === 'minecraft:player') {
        if (event) event.cancel = true;
        system.run(() => {
            try {
                damager.onScreenDisplay.setActionBar('§cEscudeiros sao pacificos!');
            } catch (e) { }
        });
        return;
    }

    // Outros membros Staff (Adm/Knight) podem lutar por justiça
    // Nota: Por serem imortais, eles são juízes supremos no combate.
}

// Helper: Lealdade do Escudeiro
function handleSquireLoyalty(player) {
    if (!player.hasTag('staff_squire') || player.hasTag('staff_loyalty_off')) return;

    // Verificação periódica (a cada 10 segundos)
    if (system.currentTick % 200 !== 0) return;

    const staffClanPos = { x: 782, y: 72, z: -679 }; // Base Staff
    const distToBase = Math.sqrt((player.location.x - staffClanPos.x) ** 2 + (player.location.z - staffClanPos.z) ** 2);

    if (distToBase > 300) {
        player.sendMessage('§7[LEALDADE] Voce se afastou demais da jurisdição Staff! Retornando...');
        player.teleport({ x: staffClanPos.x + 0.5, y: staffClanPos.y + 1, z: staffClanPos.z + 0.5 }, { dimension: world.getDimension('overworld') });
    }
}
