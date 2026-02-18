import { world, system } from '@minecraft/server';

/**
 * PROJETO CASTELO DE CERCO (100x100) - GERAÇÃO POR QUADRANTES
 * Quadrantes: A (NW), B (NE), C (SW), D (SE) + Centro
 */

const CASTLE_CONFIG = {
    xMin: 60, xMax: 160,
    zMin: -10, zMax: 90,
    yFloor: 80,
    dim: 'overworld'
};

// --- ESTADO DO SISTEMA (BUSY LOCK) ---
let isCastleBusy = false;
let lastPartGenerated = "Nenhuma";

export function getCastleStatus() {
    return {
        busy: isCastleBusy,
        lastPart: lastPartGenerated
    };
}

// --- GERENCIAMENTO DE CHUNKS (FORÇAR CARREGAMENTO) ---
function setupCastleTickingArea(player = null) {
    const { xMin, xMax, zMin, zMax } = CASTLE_CONFIG;
    run(`tickingarea remove castle_gen_area`, player);
    run(`tickingarea add ${xMin} -64 ${zMin} ${xMax} 320 ${zMax} castle_gen_area`, player);
}

function removeCastleTickingArea(player = null) {
    run(`tickingarea remove castle_gen_area`, player);
}

// --- CARREGAMENTO DE ESTRUTURAS (.mcstructure) ---
export function loadCastleStructure(name, x, y, z, player = null) {
    if (isCastleBusy) {
        if (player) player.sendMessage('§c[AVISO] O sistema de obras está ocupado! Aguarde.');
        return false;
    }

    isCastleBusy = true;
    const dimId = player ? player.dimension.id : CASTLE_CONFIG.dim;

    // Criar área de carregamento dinâmica no local do spawn
    run(`tickingarea remove temp_load_area`, player, dimId);
    run(`tickingarea add ${x - 32} -64 ${z - 32} ${x + 32} 320 ${z + 32} temp_load_area`, player, dimId);

    system.runTimeout(async () => {
        try {
            const result = await run(`structure load "${name}" ${x} ${y} ${z}`, null, dimId);
            
            // Limpar uma pequena coluna no ponto de origem para remover blocos técnicos (Structure/Command Blocks)
            system.runTimeout(() => {
                 run(`fill ${x} ${y - 1} ${z} ${x} ${y + 1} ${z} air`, null, dimId);
            }, 5);

            if (player && player.isValid) {
                const count = result.successCount ?? 0;
                if (count > 0) {
                    player.sendMessage(`§a[ESTRUTURA] "${name}" carregada com sucesso! (${count} blocos colocados)`);
                } else {
                    player.sendMessage(`§e[AVISO] O comando rodou, mas §60 blocos§e foram colocados. Verifique se o arquivo existe ou reinicie o servidor.`);
                }
            }
            lastPartGenerated = `Estrutura: ${name}`;
        } catch (err) {
            if (player && player.isValid) {
                player.sendMessage(`§c[ERRO] Falha ao carregar "${name}": §7${err}`);
            }
        }
        isCastleBusy = false;
        
        // Limpar ticking area depois de um tempo
        system.runTimeout(() => {
            run(`tickingarea remove temp_load_area`, null, dimId);
        }, 200);
    }, 40); 
    
    return true;
}

// --- SALVAMENTO DE ESTRUTURAS ---
export function saveStructure(name, x1, y1, z1, x2, y2, z2, player = null) {
    if (isCastleBusy) {
        if (player) player.sendMessage('§c[AVISO] O sistema está ocupado!');
        return false;
    }

    isCastleBusy = true;
    const dimId = player ? player.dimension.id : CASTLE_CONFIG.dim;

    system.run(() => {
        run(`structure save "${name}" ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} true disk`, player, dimId);
        if (player) player.sendMessage(`§a[ESTRUTURA] "${name}" salva com sucesso!`);
        player.sendMessage(`§7Arquivo: behavior_packs/clan_system/structures/${name}.mcstructure`);
        isCastleBusy = false;
    });

    return true;
}

// --- HELPER DE COMANDOS ---
function run(cmd, player = null, dimensionId = null) {
    const targetDimId = dimensionId || CASTLE_CONFIG.dim;
    const dim = world.getDimension(targetDimId);
    if (!dim) return Promise.reject("Dimensão não encontrada");

    if (dim.runCommandAsync) {
        return dim.runCommandAsync(cmd).catch((e) => {
            const msg = `§c[ERRO] §7${cmd.substring(0, 30)}... §f-> ${e}`;
            if (player && player.isValid) player.sendMessage(msg);
            throw e;
        });
    } else if (dim.runCommand) {
        try {
            return Promise.resolve(dim.runCommand(cmd));
        } catch (e) {
            return Promise.reject(e);
        }
    }
    return Promise.reject("Método de comando não disponível");
}

const safeFill = (ax, ay, az, bx, by, bz, block, player = null) => {
    for (let h = ay; h <= by; h++) {
        run(`fill ${ax} ${h} ${az} ${bx} ${h} ${bz} ${block}`, player);
    }
};


// --- ORQUESTRADORES MODULARES ---

/**
 * EXPORTAÇÃO DE SEQUÊNCIAS (Para serem chamadas no main.js)
 */

export function buildCastleCleanup(player = null) {
    if (isCastleBusy) return player?.sendMessage('§c[AVISO] Sistema ocupado!');
    isCastleBusy = true;
    lastPartGenerated = "Limpando Área...";

    setupCastleTickingArea(player);
    let step = 0;
    const interval = system.runInterval(() => {
        if (step > 2) {
            system.clearRun(interval);
            if (player) player.sendMessage('§a[CASTELO] Limpeza concluída!');
            isCastleBusy = false;
            return;
        }
        executeCastleStep(step, player);
        step++;
    }, 40); 
}

export function buildCastleQuadrant(quadrantId, player = null) {
    if (isCastleBusy) return player?.sendMessage('§c[AVISO] Sistema ocupado!');
    isCastleBusy = true;
    lastPartGenerated = `Quadrante ${quadrantId}`;

    setupCastleTickingArea(player);
    const step = quadrantId + 2; 
    executeCastleStep(step, player);
    
    system.runTimeout(() => {
        if (player) player.sendMessage(`§a[CASTELO] Quadrante ${quadrantId} concluído!`);
        isCastleBusy = false;
    }, 20);
}

export function buildCastleDetails(player = null) {
    if (isCastleBusy) return player?.sendMessage('§c[AVISO] Sistema ocupado!');
    isCastleBusy = true;
    lastPartGenerated = "Detalhes e Pátio";

    setupCastleTickingArea(player);
    let step = 7;
    const interval = system.runInterval(() => {
        if (step > 9) {
            system.clearRun(interval);
            if (player) player.sendMessage('§a[CASTELO] Detalhes e Pátio concluídos!');
            isCastleBusy = false;
            return;
        }
        executeCastleStep(step, player);
        step++;
    }, 30);
}

export function buildCastleKeep(player = null) {
    if (isCastleBusy) return player?.sendMessage('§c[AVISO] Sistema ocupado!');
    isCastleBusy = true;
    lastPartGenerated = "Keep Central";

    setupCastleTickingArea(player);
    let step = 10;
    const interval = system.runInterval(() => {
        if (step > 13) {
            system.clearRun(interval);
            if (player) player.sendMessage('§a[CASTELO] Keep e Sala do Trono concluídos!');
            world.setDynamicProperty('castle_generated', true);
            isCastleBusy = false;
            return;
        }
        executeCastleStep(step, player);
        step++;
    }, 40);
}


/**
 * Executa a construção do castelo em passos de quadrante
 */
export function executeCastleStep(step, player = null) {
    // ... (restante da função inalterado, apenas mantendo-a disponível internamente)
    const { xMin, xMax, zMin, zMax, yFloor } = CASTLE_CONFIG;
    const xMid = Math.floor((xMin + xMax) / 2); // 110
    const zMid = Math.floor((zMin + zMax) / 2); // 40

    // Limites da ilha (80x80)
    const wMin = xMin + 10; // 70
    const wMax = xMax - 10; // 150
    const dMin = zMin + 10; // 0
    const dMax = zMax - 10; // 80

    switch (step) {
        case 0: // LIMPEZA DO AR PARTE 1
            world.sendMessage('§e[CASTELO] Passo 0: Limpando espaço aéreo (Norte)...');
            for (let y = yFloor; y <= yFloor + 35; y += 7) {
                const yE = Math.min(y + 6, yFloor + 35);
                run(`fill ${xMin} ${y} ${zMin} ${xMax} ${yE} ${zMid} air`, player);
            }
            break;

        case 1: // LIMPEZA DO AR PARTE 2
            world.sendMessage('§e[CASTELO] Passo 1: Limpando espaço aéreo (Sul)...');
            for (let y = yFloor; y <= yFloor + 35; y += 7) {
                const yE = Math.min(y + 6, yFloor + 35);
                run(`fill ${xMin} ${y} ${zMid + 1} ${xMax} ${yE} ${zMax} air`, player);
            }
            // Limpa o céu extra
            safeFill(xMin, yFloor + 36, zMin, xMax, 150, 'air', player);
            break;

        case 2: // FOSSO DE ÁGUA
            world.sendMessage('§e[CASTELO] Passo 2: Cavando fosso de água real...');
            safeFill(xMin, yFloor - 5, zMin, xMax, yFloor - 1, 'water', player);
            break;

        case 3: // QUADRANTE A (NOROESTE)
            world.sendMessage('§d[QUADRANTE A] §fConstruindo Zone NW (Fundação + Torre + Muralha)...');
            // Fundação
            safeFill(wMin, yFloor - 5, dMin, xMid, yFloor, 'bedrock', player);
            // Torre NW
            run(`fill ${wMin - 4} ${yFloor - 5} ${dMin - 4} ${wMin + 4} ${yFloor + 22} ${dMin + 4} bedrock outline`, player);
            run(`fill ${wMin - 3} ${yFloor - 4} ${dMin - 3} ${wMin + 3} ${yFloor + 21} ${dMin + 3} air`, player);
            // Muralhas NW
            run(`fill ${wMin} ${yFloor + 1} ${dMin} ${xMid} ${yFloor + 12} ${dMin} bedrock`, player);
            run(`fill ${wMin} ${yFloor + 1} ${dMin} ${wMin} ${yFloor + 12} ${zMid} bedrock`, player);
            break;

        case 4: // QUADRANTE B (NORDESTE)
            world.sendMessage('§b[QUADRANTE B] §fConstruindo Zone NE (Fundação + Torre + Muralha)...');
            // Fundação
            safeFill(xMid + 1, yFloor - 5, dMin, wMax, yFloor, 'bedrock', player);
            // Torre NE
            run(`fill ${wMax - 4} ${yFloor - 5} ${dMin - 4} ${wMax + 4} ${yFloor + 22} ${dMin + 4} bedrock outline`, player);
            run(`fill ${wMax - 3} ${yFloor - 4} ${dMin - 3} ${wMax + 3} ${yFloor + 21} ${dMin + 3} air`, player);
            // Muralhas NE
            run(`fill ${xMid + 1} ${yFloor + 1} ${dMin} ${wMax} ${yFloor + 12} ${dMin} bedrock`, player);
            run(`fill ${wMax} ${yFloor + 1} ${dMin} ${wMax} ${yFloor + 12} ${zMid} bedrock`, player);
            break;

        case 5: // QUADRANTE C (SUDOESTE)
            world.sendMessage('§e[QUADRANTE C] §fConstruindo Zone SW (Fundação + Torre + Muralha)...');
            // Fundação
            safeFill(wMin, yFloor - 5, zMid + 1, xMid, yFloor, 'bedrock', player);
            // Torre SW
            run(`fill ${wMin - 4} ${yFloor - 5} ${dMax - 4} ${wMin + 4} ${yFloor + 22} ${dMax + 4} bedrock outline`, player);
            run(`fill ${wMin - 3} ${yFloor - 4} ${dMax - 3} ${wMin + 3} ${yFloor + 21} ${dMax + 3} air`, player);
            // Muralhas SW
            run(`fill ${wMin} ${yFloor + 1} ${dMax} ${xMid} ${yFloor + 12} ${dMax} bedrock`, player);
            run(`fill ${wMin} ${yFloor + 1} ${zMid + 1} ${wMin} ${yFloor + 12} ${dMax} bedrock`, player);
            break;

        case 6: // QUADRANTE D (SUDESTE)
            world.sendMessage('§a[QUADRANTE D] §fConstruindo Zone SE (Fundação + Torre + Muralha)...');
            // Fundação
            safeFill(xMid + 1, yFloor - 5, zMid + 1, wMax, yFloor, 'bedrock', player);
            // Torre SE
            run(`fill ${wMax - 4} ${yFloor - 5} ${dMax - 4} ${wMax + 4} ${yFloor + 22} ${dMax + 4} bedrock outline`, player);
            run(`fill ${wMax - 3} ${yFloor - 4} ${dMax - 3} ${wMax + 3} ${yFloor + 21} ${dMax + 3} air`, player);
            // Muralhas SE
            run(`fill ${xMid + 1} ${yFloor + 1} ${dMax} ${wMax} ${yFloor + 12} ${dMax} bedrock`, player);
            run(`fill ${wMax} ${yFloor + 1} ${zMid + 1} ${wMax} ${yFloor + 12} ${dMax} bedrock`, player);
            break;

        case 7: // ESCADAS E ACESSOS
            world.sendMessage('§e[CASTELO] Passo 7: Instalando escadas internas e acessos...');
            const towers = [
                { x: wMin, z: dMin }, { x: wMax, z: dMin },
                { x: wMin, z: dMax }, { x: wMax, z: dMax }
            ];
            towers.forEach(t => {
                run(`fill ${t.x} ${yFloor - 4} ${t.z} ${t.x} ${yFloor + 22} ${t.z} ladder ["facing_direction":2]`, player);
                run(`fill ${t.x - 1} ${yFloor + 1} ${t.z - 4} ${t.x + 1} ${yFloor + 3} ${t.z + 4} air`, player); 
                run(`fill ${t.x - 4} ${yFloor + 11} ${t.z - 1} ${t.x + 4} ${yFloor + 13} ${t.z + 1} air`, player); 
            });
            break;

        case 8: // PORTÃO E AMEIAS
            world.sendMessage('§e[CASTELO] Passo 8: Portão Real e Ameias Defensivas...');
            // Portão (Sul)
            run(`fill ${xMid - 2} ${yFloor + 1} ${dMax} ${xMid + 2} ${yFloor + 5} ${dMax} air`, player);
            run(`fill ${xMid - 2} ${yFloor + 1} ${dMax} ${xMid + 2} ${yFloor + 5} ${dMax} iron_bars`, player);
            // Ameias
            for (let x = wMin; x <= wMax; x += 3) {
                run(`setblock ${x} ${yFloor + 13} ${dMin} bedrock`, player);
                run(`setblock ${x} ${yFloor + 13} ${dMax} bedrock`, player);
            }
            for (let z = dMin; z <= dMax; z += 3) {
                run(`setblock ${wMin} ${yFloor + 13} ${z} bedrock`, player);
                run(`setblock ${wMax} ${yFloor + 13} ${z} bedrock`, player);
            }
            break;

        case 9: // PATIO INTERNO (Preenchimento final)
            world.sendMessage('§e[CASTELO] Passo 9: Pavimentando o pátio interno...');
            run(`fill ${wMin + 1} ${yFloor} ${dMin + 1} ${wMax - 1} ${yFloor} ${dMax - 1} bedrock`, player);
            break;

        case 10: // KEEP (Base)
            world.sendMessage('§6[CENTRO] §fConstruindo Base do Keep...');
            run(`fill ${xMid - 10} ${yFloor + 1} ${zMid - 10} ${xMid + 10} ${yFloor + 8} ${zMid + 10} stone_bricks outline`, player);
            run(`fill ${xMid - 9} ${yFloor + 1} ${zMid - 9} ${xMid + 9} ${yFloor + 7} ${zMid + 9} air`, player);
            // Porta do Keep
            run(`fill ${xMid - 1} ${yFloor + 1} ${zMid + 10} ${xMid + 1} ${yFloor + 4} ${zMid + 10} air`, player);
            break;

        case 11: // KEEP (2º Andar)
            world.sendMessage('§6[CENTRO] §fConstruindo Segundo Andar do Keep...');
            run(`fill ${xMid - 10} ${yFloor + 8} ${zMid - 10} ${xMid + 10} ${yFloor + 8} ${zMid + 10} stone_bricks`, player);
            run(`fill ${xMid - 8} ${yFloor + 9} ${zMid - 8} ${xMid + 8} ${yFloor + 16} ${zMid + 8} stone_bricks outline`, player);
            run(`fill ${xMid - 7} ${yFloor + 9} ${zMid - 7} ${xMid + 7} ${yFloor + 15} ${zMid + 7} air`, player);
            break;

        case 12: // SALA DO TRONO (Bedrock)
            world.sendMessage('§c§l[CENTRO] PASSO 12: CONSTRUINDO SALA DO TRONO (BEDROCK)!');
            run(`fill ${xMid - 8} ${yFloor + 16} ${zMid - 8} ${xMid + 8} ${yFloor + 16} ${zMid + 8} bedrock`, player);
            run(`fill ${xMid - 10} ${yFloor + 17} ${zMid - 10} ${xMid + 10} ${yFloor + 25} ${zMid + 10} bedrock outline`, player);
            run(`fill ${xMid - 9} ${yFloor + 17} ${zMid - 9} ${xMid + 9} ${yFloor + 24} ${zMid + 9} air`, player);
            break;

        case 13: // TRONO E ESCADAS
            world.sendMessage('§e[CASTELO] Passo 13: Instalando o Trono Real e Escadaria...');
            run(`setblock ${xMid} ${yFloor + 17} ${zMid - 8} gold_block`, player);
            for (let i = 1; i <= 25; i++) {
                run(`setblock ${xMid} ${yFloor + i} ${zMid} stone_brick_stairs ["facing_direction":${(i % 4) + 2}]`, player);
                run(`fill ${xMid - 1} ${yFloor + i} ${zMid} ${xMid + 1} ${yFloor + i} ${zMid} air`, player);
            }
            break;

        case 14: // FINALIZAÇÃO
            world.sendMessage('§a§l[CASTELO] SISTEMA DE QUADRANTES FINALIZADO COM SUCESSO! 🛡️✨');
            world.setDynamicProperty('castle_generated', true);
            run(`tickingarea remove castle_siege`, player);
            break;
    }
}

/**
 * Verifica se o jogador está na área do castelo (100x100)
 */
export function isInCastleArea(pos) {
    const { xMin, xMax, zMin, zMax } = CASTLE_CONFIG;
    return (pos.x >= xMin && pos.x <= xMax && pos.z >= zMin && pos.z <= zMax);
}

/**
 * Verifica se o jogador está na sala do trono
 */
export function isInThroneRoom(pos) {
    const { xMin, xMax, zMin, zMax, yFloor } = CASTLE_CONFIG;
    const xMid = Math.floor((xMin + xMax) / 2);
    const zMid = Math.floor((zMin + zMax) / 2);
    return (pos.x >= xMid - 10 && pos.x <= xMid + 10 && 
            pos.z >= zMid - 10 && pos.z <= zMid + 10 && 
            pos.y >= yFloor + 17);
}
