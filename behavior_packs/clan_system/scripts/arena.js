import { world, system } from '@minecraft/server';

/**
 * PROJETO ARENA PVP 60x60
 * Localização: X [-200 a -141], Z [64 a 123]
 * Piso Principal: Y=67
 */

const ARENA_CONFIG = {
    xMin: -200, xMax: -141,
    zMin: 64, zMax: 123,
    yFloor: 67,
    ySniper: 78,
    dim: 'overworld'
};

// Exportar posicoes para automacao
export const SNIPER_LOCATIONS = [
    { x: -170, z: 64 + 10, y: 78 }, // Norte (Ajustado p/ centro da parede)
    { x: -170, z: 123 - 10, y: 78 }, // Sul
    { x: -141 - 10, z: 93, y: 78 }, // Leste
    { x: -200 + 10, z: 93, y: 78 }  // Oeste
];


// Helper para rodar comandos
function run(cmd) {
    try {
        const dim = world.getDimension(ARENA_CONFIG.dim);
        if (!dim) return;
        if (dim.runCommandAsync) {
            dim.runCommandAsync(cmd).catch((e) => {
                const adminMsg = `§c[ARENA-ERRO] Falha: §7${cmd.substring(0, 30)}... §f-> ${e}`;
                world.getAllPlayers().filter(p => p.hasTag('admin') || p.hasTag('op')).forEach(p => p.sendMessage(adminMsg));
                console.warn(`[ARENA-RUN-ERRO] ${cmd} -> ${e}`);
            });
        } else if (dim.runCommand) {
            dim.runCommand(cmd);
        }
    } catch (e) {
        console.warn(`[ARENA-RUN-CRITICO] ${e}`);
    }
}

/**
 * Executa um passo específico da construção da arena 60x60
 * @param {number} step - ID do passo
 */
export function executeArenaMaintenanceStep(step) {
    const { xMin, xMax, zMin, zMax, yFloor } = ARENA_CONFIG;
    const xMid = (xMin + xMax) / 2;
    const zMid = (zMin + zMax) / 2;

    // Helper para preenchimento seguro por camadas
    const safeFill = (ax, ay, az, bx, by, bz, block) => {
        for (let h = ay; h <= by; h++) {
            run(`fill ${ax} ${h} ${az} ${bx} ${h} ${bz} ${block}`);
        }
    };

    const cx = Math.floor(xMid);
    const cz = Math.floor(zMid);

    // --- GARANTIR CARREGAMENTO (Ticking Area Expanded 70x70) ---
    // Fazemos isso em TODO passo para garantir que a area expandida (calcada) esteja ativa
    run(`tickingarea remove arena_60`);
    run(`tickingarea add ${cx - 35} 50 ${cz - 35} ${cx + 35} 150 ${cz + 35} arena_60`);
    switch (step) {
        case 0: // Limpeza Super Profunda (70x70, Y=50-150)
            world.sendMessage('§e[ARENA 2.0] Passo 0: Varrendo área expandida 70x70 (Y=50-150)...');
            
            const cx0 = Math.floor(xMid);
            const cz0 = Math.floor(zMid);
            
            // Ativar Ticking Area Expandida
            run(`tickingarea remove arena_60`);
            run(`tickingarea add ${cx0 - 35} 50 ${cz0 - 35} ${cx0 + 35} 150 ${cz0 + 35} arena_60`);


            // Limpeza em Quadrantes (Garante que nunca falha por volume ou lag)
            for (let y = 50; y <= 150; y += 5) {
                const yEnd = y + 4;
                // Quadrante NW
                run(`fill ${cx0 - 35} ${y} ${cz0 - 35} ${cx0} ${yEnd} ${cz0} air`);
                // Quadrante NE
                run(`fill ${cx0 + 1} ${y} ${cz0 - 35} ${cx0 + 35} ${yEnd} ${cz0} air`);
                // Quadrante SW
                run(`fill ${cx0 - 35} ${y} ${cz0 + 1} ${cx0} ${yEnd} ${cz0 + 35} air`);
                // Quadrante SE
                run(`fill ${cx0 + 1} ${y} ${cz0 + 1} ${cx0 + 35} ${yEnd} ${cz0 + 35} air`);
            }
            break;

        case 1: // Fundo da Arena
            world.sendMessage('§e[ARENA 2.0] Passo 1: Construindo FUNDO (Bedrock)...');
            run(`fill ${xMin} 50 ${zMin} ${xMax} 57 ${zMax} bedrock`);
            break;

        case 2: // Parede Norte
            world.sendMessage('§e[ARENA 2.0] Passo 2: Erguendo PAREDE NORTE...');
            run(`fill ${xMin} 50 ${zMin} ${xMax} 80 ${zMin} bedrock`);
            break;

        case 3: // Parede Sul
            world.sendMessage('§e[ARENA 2.0] Passo 3: Erguendo PAREDE SUL...');
            run(`fill ${xMin} 50 ${zMax} ${xMax} 80 ${zMax} bedrock`);
            break;

        case 4: // Parede Leste
            world.sendMessage('§e[ARENA 2.0] Passo 4: Erguendo PAREDE LESTE...');
            run(`fill ${xMax} 50 ${zMin} ${xMax} 80 ${zMax} bedrock`);
            break;

        case 5: // Parede Oeste
            world.sendMessage('§e[ARENA 2.0] Passo 5: Erguendo PAREDE OESTE...');
            run(`fill ${xMin} 50 ${zMin} ${xMin} 80 ${zMax} bedrock`);
            break;

        case 6: // Encher de Água + Calçada Externa
            world.sendMessage('§e[ARENA 2.0] Passo 6: Enchendo tanque e construindo CALÇADA EXTERNA (Y=68)...');
            
            // 1. Água interna (60x60)
            safeFill(xMin + 1, 58, zMin + 1, xMax - 1, 68, zMax - 1, 'water');
            
            // 2. Calçada Externa (70x70, Y=68)
            const cx6 = Math.floor(xMid);
            const cz6 = Math.floor(zMid);
            
            // Construir em fitas solidas para garantir cobertura 100%
            run(`fill ${cx6 - 35} 68 ${cz6 - 35} ${cx6 + 35} 68 ${cz6 - 31} bedrock`); // Norte
            run(`fill ${cx6 - 35} 68 ${cz6 + 31} ${cx6 + 35} 68 ${cz6 + 35} bedrock`); // Sul
            run(`fill ${cx6 - 35} 68 ${cz6 - 30} ${cx6 - 31} 68 ${cz6 + 30} bedrock`); // Oeste
            run(`fill ${cx6 + 31} 68 ${cz6 - 30} ${cx6 + 35} 68 ${cz6 + 30} bedrock`); // Leste
            break;




        case 7: // Copos de Lava MASSIVOS (20x20, Suspensos)
            world.sendMessage('§e[ARENA 2.0] Passo 7: Criando poços de lava 20x20 (Suspensos em Y=60)...');
            const lavaPos = [
                { x: Math.floor(xMid) - 14, z: Math.floor(zMid) - 14 },
                { x: Math.floor(xMid) + 14, z: Math.floor(zMid) - 14 },
                { x: Math.floor(xMid) - 14, z: Math.floor(zMid) + 14 },
                { x: Math.floor(xMid) + 14, z: Math.floor(zMid) + 14 }
            ];
            lavaPos.forEach(p => {
                // Estrutura Externa 20x20 (Raio 10: -10 a +9)
                run(`fill ${p.x - 10} 60 ${p.z - 10} ${p.x + 9} 68 ${p.z + 9} bedrock outline`);
                // Limpeza interna e Fundo (Y=60)
                run(`fill ${p.x - 9} 61 ${p.z - 9} ${p.x + 8} 68 ${p.z + 8} air`);
                run(`fill ${p.x - 9} 60 ${p.z - 9} ${p.x + 8} 60 ${p.z + 8} bedrock`);
                // Injeção de Lava
                run(`fill ${p.x - 9} 61 ${p.z - 9} ${p.x + 8} 68 ${p.z + 8} lava`);
            });
            break;



        case 8: // Torres Estratégicas
            world.sendMessage('§e[ARENA 2.0] Passo 8: Erguendo torres estratégicas...');
            const towerPos = [
                { x: Math.floor(xMid) - 22, z: Math.floor(zMid) - 22 },
                { x: Math.floor(xMid) + 22, z: Math.floor(zMid) - 22 },
                { x: Math.floor(xMid) - 22, z: Math.floor(zMid) + 22 },
                { x: Math.floor(xMid) + 22, z: Math.floor(zMid) + 22 }
            ];
            towerPos.forEach(p => {
                run(`fill ${p.x} 58 ${p.z} ${p.x} 91 ${p.z} bedrock`);
                run(`fill ${p.x - 2} 68 ${p.z - 2} ${p.x + 2} 68 ${p.z + 2} bedrock`);
                run(`fill ${p.x - 1} 91 ${p.z - 1} ${p.x + 1} 91 ${p.z + 1} bedrock`);
            });
            const cx = Math.floor(xMid);
            const cz = Math.floor(zMid);
            run(`fill ${cx} 58 ${cz} ${cx} 91 ${cz} bedrock`);
            run(`fill ${cx - 2} 68 ${cz - 2} ${cx + 2} 68 ${cz + 2} bedrock`);
            run(`fill ${cx + 1} 69 ${cz} ${cx + 1} 91 ${cz} ladder ["facing_direction":3]`);
            break;

        case 9: // Pisos de Skeleton (6x6 Bedrock - Aberto)
            world.sendMessage('§e[ARENA 2.0] Passo 9: Instalando snipers automáticos...');
            SNIPER_LOCATIONS.forEach(p => {
                run(`fill ${p.x - 2} ${p.y} ${p.z - 2} ${p.x + 3} ${p.y} ${p.z + 3} bedrock`);
                run(`setblock ${p.x} ${p.y + 1} ${p.z} bedrock`);
                run(`setblock ${p.x} ${p.y + 2} ${p.z} mob_spawner`);
            });
            world.sendMessage('§a§l[ARENA 2.0] Estrutura interna finalizada!');
            break;

        case 10: // Teto de Sombra (Bedrock @ Y=96)
            world.sendMessage('§e[ARENA 2.0] Passo 10: Construindo TETO (Y=96)...');
            run(`fill ${xMin} 96 ${zMin} ${xMax} 96 ${zMax} bedrock`);
            
            // Opcional: Remover ticking area após concluir tudo
            // run(`tickingarea remove arena_60`);
            break;

        case 11: // Pontes de Conexão entre Torres
            world.sendMessage('§e[ARENA 2.0] Passo 11: Construindo PONTES de conexão...');
            const tx = Math.floor(xMid);
            const tz = Math.floor(zMid);
            
            // Coordenadas dos pilares das 4 torres (Baseadas no Passo 8)
            const tNW = { x: tx - 22, z: tz - 22 };
            const tNE = { x: tx + 22, z: tz - 22 };
            const tSW = { x: tx - 22, z: tz + 22 };
            const tSE = { x: tx + 22, z: tz + 22 };

            // --- PONTES SUPERIORES (Y=91, Largura 1) ---
            // Norte (NW-NE)
            run(`fill ${tNW.x + 2} 91 ${tNW.z} ${tNE.x - 2} 91 ${tNE.z} bedrock`);
            // Sul (SW-SE)
            run(`fill ${tSW.x + 2} 91 ${tSW.z} ${tSE.x - 2} 91 ${tSE.z} bedrock`);
            // Oeste (NW-SW)
            run(`fill ${tNW.x} 91 ${tNW.z + 2} ${tSW.x} 91 ${tSW.z - 2} bedrock`);
            // Leste (NE-SE)
            run(`fill ${tNE.x} 91 ${tNE.z + 2} ${tSE.x} 91 ${tSE.z - 2} bedrock`);

            // --- PONTES INFERIORES (Y=68, Largura 3) ---
            // Norte
            run(`fill ${tNW.x + 3} 68 ${tNW.z - 1} ${tNE.x - 3} 68 ${tNE.z + 1} bedrock`);
            // Sul
            run(`fill ${tSW.x + 3} 68 ${tSW.z - 1} ${tSE.x - 3} 68 ${tSE.z + 1} bedrock`);
            // Oeste
            run(`fill ${tNW.x - 1} 68 ${tNW.z + 3} ${tSW.x + 1} 68 ${tSW.z - 3} bedrock`);
            // Leste
            run(`fill ${tNE.x - 1} 68 ${tNE.z + 3} ${tSE.x + 1} 68 ${tSE.z - 3} bedrock`);

            world.sendMessage('§a§l[ARENA 2.0] Pontes concluídas! Arena Finalizada!');
            world.setDynamicProperty('arena_120_generated', true);
            break;
    }
}




// Loop de Spawning de Mobs na Arena (Continua independente)
system.runInterval(() => {
    const isGenerated = world.getDynamicProperty('arena_120_generated');
    if (!isGenerated) return;

    const dim = world.getDimension(ARENA_CONFIG.dim);
    const xMid = (ARENA_CONFIG.xMin + ARENA_CONFIG.xMax) / 2;
    const zMid = (ARENA_CONFIG.zMin + ARENA_CONFIG.zMax) / 2;
    
    try {
        const actors = dim.getEntities({
            location: { x: xMid, y: 68, z: zMid },
            maxDistance: 40,
            families: ['monster']
        });

        if (actors.length < 10) {
            const spawnX = xMid + (Math.random() - 0.5) * 40;
            const spawnZ = zMid + (Math.random() - 0.5) * 40;
            const mobTypes = ['minecraft:zombie', 'minecraft:skeleton', 'minecraft:spider'];
            const type = mobTypes[Math.floor(Math.random() * mobTypes.length)];
            
            dim.spawnEntity(type, { x: spawnX, y: 68, z: spawnZ });
        }
    } catch (e) {}
}, 300);

// --- NOVO: LIMPEZA DE DROPS NA ARENA (2 em 2 segundos) ---
system.runInterval(() => {
    try {
        const isGenerated = world.getDynamicProperty('arena_120_generated');
        if (!isGenerated) return;

        const dim = world.getDimension(ARENA_CONFIG.dim);
        const xMid = (ARENA_CONFIG.xMin + ARENA_CONFIG.xMax) / 2;
        const zMid = (ARENA_CONFIG.zMin + ARENA_CONFIG.zMax) / 2;

        // Pegar todos os itens (drops) na area expandida da arena
        const drops = dim.getEntities({
            location: { x: xMid, y: 75, z: zMid },
            maxDistance: 45, // Cobre 90x90 (mais que os 70x70 da limpeza)
            typeId: 'minecraft:item'
        });

        // Remover os itens encontrados
        for (const item of drops) {
            item.remove();
        }
    } catch (e) {}
}, 40); // Executa a cada 2 segundos (40 ticks)

