import { world, system } from '@minecraft/server';
import { CLANS, TOTEM_CONFIG } from '../clans/clans_config.js';

// Manutenção Automática de Totens (a cada 30 segundos)
system.runInterval(() => {
    try {
        for (const config of TOTEM_CONFIG) {
            const dim = world.getDimension(config.dimension);
            if (!dim) continue;

            const targetLoc = config.location;
            const nearbyEntities = dim.getEntities({
                location: { x: targetLoc.x + 0.5, y: targetLoc.y, z: targetLoc.z + 0.5 },
                maxDistance: 5
            });

            let validEntity = null;
            for (const entity of nearbyEntities) {
                if (entity.typeId !== config.typeId && !entity.hasTag(config.tag)) continue;

                if (entity.hasTag(config.tag)) {
                    if (validEntity) {
                        // Duplicado: remover
                        try {
                            system.run(() => { try { entity.remove(); } catch (e) { } });
                        } catch (e) { }
                    } else {
                        validEntity = entity;
                    }
                }
            }

            if (!validEntity) {
                system.run(() => {
                    try {
                        const newEntity = dim.spawnEntity(config.typeId, {
                            x: targetLoc.x + 0.5,
                            y: targetLoc.y,
                            z: targetLoc.z + 0.5
                        });
                        newEntity.addTag(config.tag);
                        newEntity.addTag('totem_npc');
                        newEntity.nameTag = config.name;
                        newEntity.addEffect('resistance', 20000000, { amplifier: 255, showParticles: false });
                        newEntity.addEffect('weakness', 20000000, { amplifier: 255, showParticles: false });
                    } catch (e) { }
                });
            } else {
                // Garantir posição e efeitos
                const currentPos = validEntity.location;
                if (
                    Math.abs(currentPos.x - (targetLoc.x + 0.5)) > 0.5 ||
                    Math.abs(currentPos.z - (targetLoc.z + 0.5)) > 0.5
                ) {
                    try {
                        validEntity.teleport({ x: targetLoc.x + 0.5, y: targetLoc.y, z: targetLoc.z + 0.5 },
                            { dimension: dim });
                    } catch (e) { }
                }
                validEntity.addEffect('resistance', 20000000, { amplifier: 255, showParticles: false });
                validEntity.addEffect('slowness', 20000000, { amplifier: 255, showParticles: false });
            }
        }
    } catch (e) {
        console.warn(`[CLANS] Erro no loop de manutencao: ${e}`);
    }
}, 600); // 30 segundos
