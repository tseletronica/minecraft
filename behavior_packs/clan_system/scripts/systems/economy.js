import { world, system } from '@minecraft/server';
import { getPlayerScore, addPlayerScore } from './utils.js';

// ==================================
// SISTEMA DE ECONOMIA (Moedas / Coins)
// ==================================

// Inicializar placares e sincronizar moedas a cada 1 segundo
system.runInterval(() => {
    try {
        let objective = world.scoreboard.getObjective('coins');
        if (!objective) objective = world.scoreboard.addObjective('coins', '§6Coins');

        let killObjective = world.scoreboard.getObjective('player_kills');
        if (!killObjective) world.scoreboard.addObjective('player_kills', '§cAbates');

        world.scoreboard.setObjectiveAtDisplaySlot('sidebar', { objective });

        for (const player of world.getAllPlayers()) {
            try {
                // Registrar ID único para resolver nomes offline
                const identity = player.scoreboardIdentity;
                if (identity) {
                    world.setDynamicProperty(`name_id_${identity.id}`, player.name);
                }

                // Unificar fragmentos de score de kills
                const killObj = world.scoreboard.getObjective('player_kills');
                if (killObj) {
                    for (const p of killObj.getParticipants()) {
                        if (p.displayName === player.name && !p.getEntity()) {
                            const stringScore = killObj.getScore(p) || 0;
                            if (stringScore > 0) {
                                killObj.removeParticipant(p);
                                addPlayerScore(player, 'player_kills', stringScore);
                            }
                        }
                    }
                }

                // Backup e Restauração de Moedas (anti-reset)
                const currentCoins = getPlayerScore(player, 'coins') ?? 0;
                const savedCoins = world.getDynamicProperty(`score_coins_${player.name}`) ?? 0;
                if (currentCoins > savedCoins) world.setDynamicProperty(`score_coins_${player.name}`, currentCoins);
                if (currentCoins < savedCoins) addPlayerScore(player, 'coins', savedCoins - currentCoins);

            } catch (e) { }
        }
    } catch (e) { }
}, 20);

// Contador de abates (ao matar outro player)
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
