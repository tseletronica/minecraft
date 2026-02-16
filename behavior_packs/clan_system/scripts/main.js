import { world, system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { SHOP_CATEGORIES } from './config.js';

// Configuração dos clãs e coordenadas das bases (Onde os totens SEMPRE devem estar)
// Função para carregar bases salvas (PERSISTÊNCIA)
function loadClanBase(clanKey, defaultBase, defaultDim) {
    try {
        const savedData = world.getDynamicProperty(`clan_base_${clanKey}`);
        if (savedData) {
            const data = JSON.parse(savedData);
            return { base: data.base, dimension: data.dimension };
        }
    } catch (e) {}
    return { base: defaultBase, dimension: defaultDim || 'overworld' };
}

// Raio de proteção da base (em blocos)
const CLAN_BASE_RADIUS = 30;

// Configuração dos clãs (Carrega do salvo ou usa padrão)
const CLANS = {
    red: { 
        name: 'RED', 
        color: '§c', 
        tag: 'clan_red',
        ...loadClanBase('red', { x: 42, y: 43, z: -225 }, 'nether')
    },
    blue: { 
        name: 'BLUE', 
        color: '§9', 
        tag: 'clan_blue',
        ...loadClanBase('blue', { x: -678, y: 24, z: 631 }, 'overworld')
    },
    green: { 
        name: 'GREEN', 
        color: '§a', 
        tag: 'clan_green',
        ...loadClanBase('green', { x: -927, y: -17, z: -976 }, 'overworld')
    },
    yellow: { 
        name: 'YELLOW', 
        color: '§e', 
        tag: 'clan_yellow',
        ...loadClanBase('yellow', { x: -483, y: 170, z: 509 }, 'overworld')
    }
};

//------------------------------------------
// CONFIGURAÇÃO DOS TOTENS (Manutenção Automática)
//------------------------------------------
const TOTEM_CONFIG = [
    {
        id: 'red_totem',
        location: CLANS.red.base,
        dimension: CLANS.red.dimension || 'nether',
        tag: 'totem_red',
        name: '§c§lTOTEM RED',
        typeId: 'clans:totem_red',
        aura: 'minecraft:redstone_ore_dust_particle'
    },
    {
        id: 'blue_totem',
        location: CLANS.blue.base,
        dimension: CLANS.blue.dimension || 'overworld',
        tag: 'totem_blue',
        name: '§9§lTOTEM BLUE',
        typeId: 'clans:totem_blue',
        aura: 'minecraft:conduit_particle'
    },
    {
        id: 'green_totem',
        location: CLANS.green.base,
        dimension: CLANS.green.dimension || 'overworld',
        tag: 'totem_green',
        name: '§a§lTOTEM GREEN',
        typeId: 'clans:totem_green',
        aura: 'minecraft:villager_happy'
    },
    {
        id: 'yellow_totem',
        location: CLANS.yellow.base,
        dimension: CLANS.yellow.dimension || 'overworld',
        tag: 'totem_yellow',
        name: '§e§lTOTEM YELLOW',
        typeId: 'clans:totem_yellow',
        aura: 'minecraft:totem_particle'
    },
    {
        id: 'shop',
        location: { x: -43, y: 67, z: 54 },
        dimension: 'overworld',
        tag: 'clan_shop',
        name: '§6§lLOJA DO CLÃ',
        typeId: 'minecraft:npc'
    }
];

//------------------------------------------
// UTILITÁRIOS
//------------------------------------------
function checkAdmin(player) {
    if (!player) return false;
    try {
        const tags = player.getTags();
        const colorRegex = /§[0-9a-fk-or]/g;
        return tags.some(tag => {
            const cleanTag = tag.replace(colorRegex, '').toLowerCase();
            return cleanTag.includes('admin') || cleanTag.includes('op') || cleanTag.includes('staff');
        });
    } catch(e) { return false; }
}

//------------------------------------------
// ECONOMIA (SISTEMA DE DINHEIRO)
//------------------------------------------
system.runInterval(() => {
    try {
        if (!world.scoreboard.getObjective('coins')) {
            world.scoreboard.addObjective('coins', '§6Coins');
        }
        const objective = world.scoreboard.getObjective('coins');
        if (objective) {
            // MOSTRAR NA LATERAL DIREITA (Sidebar)
            world.scoreboard.setObjectiveAtDisplaySlot('sidebar', { objective: objective });

            for (const player of world.getAllPlayers()) {
                if (objective.getScore(player) === undefined) {
                    objective.setScore(player, 0);
                }
            }
        }
    } catch (e) {}
}, 100);

// MOSTRAR SALDO NA TELA (REMOVIDO ACTIONBAR POR FAVOR DO SIDEBAR)


// Rastrear último atacante de cada jogador
const lastAttacker = new Map();
// Rastrear se o jogador estava em uma base (para alertas)
const playerBaseState = new Map();

// Detectar quando um jogador ataca outro
world.afterEvents.entityHitEntity.subscribe((event) => {
    const attacker = event.damagingEntity;
    const victim = event.hitEntity;
    
    if (attacker?.typeId === 'minecraft:player' && victim?.typeId === 'minecraft:player') {
        // Salvar quem atacou quem
        lastAttacker.set(victim.id, attacker);
        
        console.warn(`[CLANS] Hit: ${attacker.name} -> ${victim.name}`);
        
        // Limpar depois de 1 segundo
        system.runTimeout(() => {
            lastAttacker.delete(victim.id);
        }, 20);
    }
});

// Impedir dano entre membros do mesmo clã (Friendly Fire OFF)
// Tentar inscrever no evento de dano (Suporta entityDamage ou entityHurt dependendo da versao beta)
const damageNotifier = world.beforeEvents.entityDamage || world.beforeEvents.entityHurt;

if (damageNotifier) {
    damageNotifier.subscribe((event) => {
        // PADRÃO 1.14.0-BETA / 1.13.0
        const victim = event.entity || event.hurtEntity;
        let damager = event.damageSource.damagingEntity;

    // PROTEÇÃO TOTAL DO TOTEM (Não pode ser quebrado)
    if (victim.hasTag('totem_npc')) {
        event.cancel = true;
        return;
    }
    
    // Se não conseguiu pegar o damager, tentar pelo mapa
    if (!damager && victim.typeId === 'minecraft:player') {
        damager = lastAttacker.get(victim.id);
    }
    
    //------------------------------------------
    // HABILIDADE CLÃ GREEN: Imunidade PVE (exceto Bosses)
    //------------------------------------------
    if (victim.typeId === 'minecraft:player' && victim.hasTag(CLANS.green.tag)) {
        // Se o atacante existir e NÃO for jogador
        if (damager && damager.typeId !== 'minecraft:player') {
            const BOSSES = [
                'minecraft:ender_dragon',
                'minecraft:wither',
                'minecraft:warden',
                'minecraft:elder_guardian'
            ];
            
            // Se NÃO for um Boss, cancelar dano
            if (!BOSSES.includes(damager.typeId)) {
                event.cancel = true;
                return;
            }
        }
    }
    
    //------------------------------------------
    // HABILIDADE CLÃ RED: Imunidade a Fogo/Lava
    //------------------------------------------
    if (victim.typeId === 'minecraft:player' && victim.hasTag(CLANS.red.tag)) {
        const FIRE_SOURCES = [
            'lava', 
            'magma', 
            'fire', 
            'fireTick'
        ];
        
        if (event.damageSource.cause && FIRE_SOURCES.includes(event.damageSource.cause)) {
            event.cancel = true;
            return;
        }
    }

    //------------------------------------------
    // HABILIDADE CLÃ BLUE: Imunidade a Afogamento (Respirar na água)
    //------------------------------------------
    if (victim.typeId === 'minecraft:player' && victim.hasTag(CLANS.blue.tag)) {
        if (event.damageSource.cause === 'drowning') {
            event.cancel = true;
            return;
        }
    }


    //------------------------------------------
    // HABILIDADE CLÃ YELLOW: Imunidade a Queda
    //------------------------------------------
    if (victim.typeId === 'minecraft:player' && victim.hasTag(CLANS.yellow.tag)) {
        // Imunidade a Queda (Sempre ativa)
        if (event.damageSource.cause === 'fall') {
            event.cancel = true;
            return;
        }
    }
    

    //------------------------------------------
    // PROTEÇÃO PVP NOS TOTENS (TODOS OS CLÃS)
    //------------------------------------------
    if (victim?.typeId === 'minecraft:player' && damager?.typeId === 'minecraft:player') {
        for (const clanKey in CLANS) {
            const clan = CLANS[clanKey];
            
            // Verificar se a VITIMA está na base do SEU clã
            if (victim.hasTag(clan.tag) && isInClanBase(victim, clanKey)) {
                event.cancel = true;
                damager.sendMessage(`§c✖ Este jogador esta protegido pelo Totem ${clan.color}${clan.name}§c!`);
                console.warn(`[CLANS] ✓ TOTEM PROTECTION: ${damager.name} -> ${victim.name} (${clan.name})`);
                return;
            }
        }
        
        // YELLOW CLAN: Também não pode atacar outros se estiver na base
        if (damager.hasTag(CLANS.yellow.tag) && isInClanBase(damager, 'yellow')) {
            event.cancel = true;
            damager.sendMessage('§cVoce nao pode atacar jogadores dentro da sua base pacifica!');
            return;
        }
    }
    //------------------------------------------
    
    
    
    // Verificar se ambos são jogadores
    if (victim?.typeId === 'minecraft:player' && damager?.typeId === 'minecraft:player') {
        console.warn(`[CLANS] Damage: ${damager.name} -> ${victim.name}`);
        
        // Verificar se estão no mesmo clã
        for (const clanKey in CLANS) {
            const clan = CLANS[clanKey];
            
            if (victim.hasTag(clan.tag) && damager.hasTag(clan.tag)) {
                // Mesmo clã - cancelar dano
                event.cancel = true;
                damager.sendMessage(`§c✖ Voce nao pode atacar membros do seu cla!`);
                console.warn(`[CLANS] Blocked friendly fire: ${damager.name} -> ${victim.name} (${clan.name})`);
                return;
            }
        }
        
        console.warn(`[CLANS] Allowed damage: ${damager.name} -> ${victim.name} (different clans)`);
    }
});
}

// Inicialização
console.warn('[CLANS] Script main.js carregado');
// Enviar mensagem após o mundo carregar
system.runTimeout(() => {
    world.sendMessage('§d[SISTEMA] Clãs carregado - VERSÃO 1.2.4');
    console.warn('[CLANS] Sistema iniciado - VERSAO 1.2.4 - SIDEBAR_UI');
}, 20);

// Quando um jogador entra no servidor
world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    
    // Verificar se é o primeiro spawn
    if (!event.initialSpawn) return;
    
    // FORCAR PERMISSAO DE MEMBER (corrigir bug do mundo)
    system.runTimeout(() => {
        try {
            if (player.runCommandAsync) {
                player.runCommandAsync('permission set @s member').catch(() => {});
            } else if (player.runCommand) {
                player.runCommand('permission set @s member');
            }
        } catch (e) {}
    }, 5);
    

    
    // Verificar se o jogador já está em algum clã
    let hasClã = false;
    for (const clanKey in CLANS) {
        if (player.hasTag(CLANS[clanKey].tag)) {
            hasClã = true;
            const clan = CLANS[clanKey];
            
            // Atualizar nome: clã e nick com a mesma cor
            player.nameTag = `${clan.color}[${clan.name}]\n${player.name}`;
            
            player.sendMessage(`${clan.color}[${clan.name}] §7Bem-vindo de volta ao cla ${clan.color}${clan.name}§7!`);
            world.sendMessage(`${clan.color}${player.name} §7entrou no servidor (Cla ${clan.color}${clan.name}§7)`);
            break;
        }
    }
    
    // Se não está em nenhum clã, mostrar menu de seleção
    if (!hasClã) {
        system.runTimeout(() => {
            showClanSelectionMenu(player);
        }, 40); // 2 segundos de delay
    }
});

// Menu de seleção de clã
async function showClanSelectionMenu(player) {
    if (!player) return;
    
    // LIMPEZA PREVENTIVA DE TAGS DE NPC (Caso o player tenha pego por erro de scripts anteriores)
    try {
        const npcTags = ['totem_npc', 'clan_shop', 'totem_red', 'totem_blue', 'totem_green', 'totem_yellow'];
        for (const t of npcTags) if (player.hasTag(t)) player.removeTag(t);
    } catch(e) {}

    const form = new ActionFormData()
        .title('§6Escolha seu Cla!')
        .body('§7Bem-vindo ao servidor!\n§7Escolha um cla para fazer parte:');
    
    form.button(`${CLANS.red.color}[RED]\n§7Cla Vermelho`);
    form.button(`${CLANS.blue.color}[BLUE]\n§7Cla Azul`);
    form.button(`${CLANS.green.color}[GREEN]\n§7Cla Verde`);
    form.button(`${CLANS.yellow.color}[YELLOW]\n§7Cla Amarelo`);
    
    const response = await form.show(player);
    if (!player || response.canceled) {
        system.runTimeout(() => { if (player) showClanSelectionMenu(player); }, 100);
        return;
    }
    
    const clanKeys = ['red', 'blue', 'green', 'yellow'];
    const selectedClan = CLANS[clanKeys[response.selection]];
    player.addTag(selectedClan.tag);
    player.nameTag = `${selectedClan.color}[${selectedClan.name}]\n${player.name}`;
    
    player.sendMessage(`${selectedClan.color}[${selectedClan.name}] §aVoce entrou no cla ${selectedClan.color}${selectedClan.name}§a!`);
    world.sendMessage(`${selectedClan.color}${player.name} §7entrou no ${selectedClan.color}[${selectedClan.name}]§7!`);
}

// Atualizar nomes dos jogadores a cada 5 segundos (para garantir que não são resetados)
let tickCount = 0;
system.runInterval(() => {
    tickCount++;
    
    // A cada 100 ticks (5 segundos) - atualizar nomes
    if (tickCount >= 100) {
        tickCount = 0;
        updatePlayerNames();
    }
}, 1);

// Função para atualizar os nomes dos jogadores com seus clãs
function updatePlayerNames() {
    try {
        for (const player of world.getAllPlayers()) {
            // Verificar qual clã o jogador está
            for (const clanKey in CLANS) {
                const clan = CLANS[clanKey];
                if (player.hasTag(clan.tag)) {
                    // Atualizar nome se necessário
                    let clanPrefix = `${clan.color}[${clan.name}]`;
                    if (player.hasTag('clan_leader')) {
                        clanPrefix += '§6[LIDER]';
                    }
                    
                    if (!player.nameTag.startsWith(clanPrefix)) {
                        player.nameTag = `${clanPrefix}\n${player.name}`;
                    }
                    break;
                }
            }
        }
    } catch (error) {
        console.warn('[CLANS] Erro ao atualizar nomes:', error);
    }
}

//------------------------------------------
// EFEITOS PASSIVOS E ALERTAS DE TERRITÓRIO
//------------------------------------------
system.runInterval(() => {
    try {
        const allPlayers = world.getAllPlayers();
        
        // EFETOS PASSIVOS POR CLÃ
        for (const player of allPlayers) {
            // 🟢 CLÃ GREEN: Visão Noturna
            if (player.hasTag(CLANS.green.tag)) {
                const nv = player.getEffect('night_vision');
                if (!nv || nv.duration < 220) player.addEffect('night_vision', 24000, { showParticles: false });
            }

            // 🔵 CLÃ BLUE: Respiração Aquática + Visão Submersa
            if (player.hasTag(CLANS.blue.tag)) {
                // Respiração
                const wb = player.getEffect('water_breathing');
                if (!wb || wb.duration < 220) player.addEffect('water_breathing', 24000, { showParticles: false });
                
                // Visão Submersa (Night Vision na água)
                const isUnderwater = player.isInWater;
                const nv = player.getEffect('night_vision');
                if (isUnderwater) {
                    if (!nv || nv.duration < 220) player.addEffect('night_vision', 24000, { showParticles: false });
                } else if (nv && nv.duration > 20000) { // Remover se não estiver na água (e for o nosso efeito longo)
                    player.removeEffect('night_vision');
                }
            }

            // 🔴 CLÃ RED: Resistência ao Fogo
            if (player.hasTag(CLANS.red.tag)) {
                const fr = player.getEffect('fire_resistance');
                if (!fr || fr.duration < 220) player.addEffect('fire_resistance', 24000, { showParticles: false });
            }

            // --- DEFESA NOS TOTENS (TODOS OS CLÃS) ---
            let nearOwnTotem = false;
            let currentBaseKey = null;

            for (const clanKey in CLANS) {
                const clan = CLANS[clanKey];
                const inThisBase = isInBase(player, clan.base, clan.dimension || 'overworld');
                
                if (inThisBase) currentBaseKey = clanKey;

                if (player.hasTag(clan.tag) && inThisBase) {
                    nearOwnTotem = true;
                    const res = player.getEffect('resistance');
                    if (!res || res.amplifier < 250) player.addEffect('resistance', 300, { amplifier: 255, showParticles: false });
                }
            }

            if (!nearOwnTotem) {
                const res = player.getEffect('resistance');
                if (res && res.amplifier >= 250) player.removeEffect('resistance');
            }

            // --- ALERTAS DE TERRITÓRIO (Action Bar) ---
            const lastBaseKey = playerBaseState.get(player.id);
            if (currentBaseKey !== lastBaseKey) {
                if (currentBaseKey) {
                    const clan = CLANS[currentBaseKey];
                    player.onScreenDisplay.setActionBar(`§eEntrando no territorio do Cla ${clan.color}${clan.name}`);
                } else if (lastBaseKey) {
                    player.onScreenDisplay.setActionBar(`§cSaindo de area protegida`);
                }
                playerBaseState.set(player.id, currentBaseKey);
            }
        }
    } catch (error) {}
}, 20); // Agora rodando a cada 1 segundo (20 ticks) para radar instantâneo

// Helper rápido para base
function isInBase(player, base, dimensionId) {
    // Normalizar ID da dimensão (Remover 'minecraft:' se existir para comparação)
    const pDim = player.dimension.id.replace('minecraft:', '');
    const bDim = dimensionId.replace('minecraft:', '');
    
    if (pDim !== bDim) return false;
    
    const dist = Math.sqrt((player.location.x - base.x)**2 + (player.location.z - base.z)**2);
    return dist < CLAN_BASE_RADIUS;
}

//------------------------------------------
// CANCELAMENTO DE DANOS ESPECÍFICOS
//------------------------------------------
world.beforeEvents.entityHurt.subscribe((event) => {
    const player = event.hurtEntity;
    if (player.typeId !== 'minecraft:player') return;

    // 🟡 CLÃ YELLOW: Imunidade a Dano de Queda
    if (player.hasTag(CLANS.yellow.tag) && event.damageSource.cause === 'fall') {
        event.cancel = true;
        return;
    }

    // 🟢 CLÃ GREEN: Imunidade a Monstros (Exceto Bosses)
    if (player.hasTag(CLANS.green.tag)) {
        const source = event.damageSource.damagingEntity;
        if (source) {
            const bosses = ['minecraft:ender_dragon', 'minecraft:wither', 'minecraft:warden', 'minecraft:elder_guardian'];
            if (!bosses.includes(source.typeId) && (source.hasTag('mob') || source.typeId.includes('minecraft:'))) {
                // Se for um mob hostil comum (Zombie, Skeleton, Slime, etc.)
                const hostileMobs = [
                    'minecraft:zombie', 'minecraft:skeleton', 'minecraft:creeper', 'minecraft:spider',
                    'minecraft:slime', 'minecraft:enderman', 'minecraft:witch', 'minecraft:husk',
                    'minecraft:stray', 'minecraft:drowned', 'minecraft:phantom', 'minecraft:ghast',
                    'minecraft:magma_cube', 'minecraft:blaze', 'minecraft:piglin', 'minecraft:hoglin'
                ];
                if (hostileMobs.includes(source.typeId) || source.typeId.includes('zombie') || source.typeId.includes('skeleton')) {
                    event.cancel = true;
                    return;
                }
            }
        }
    }
});

//------------------------------------------
// MANUTENÇÃO AUTOMÁTICA DE TOTENS (Corrige duplicados e spawn)
//------------------------------------------
system.runInterval(() => {
    try {
        for (const config of TOTEM_CONFIG) {
            const dim = world.getDimension(config.dimension);
            if (!dim) continue;

            const targetLoc = config.location;

            // Encontrar Totems próximos
            const nearbyEntities = dim.getEntities({
                typeId: config.typeId,
                location: targetLoc,
                maxDistance: 4
            });

            let validEntity = null;
            
            // 1. Filtrar e remover duplicados/inválidos
            for (const entity of nearbyEntities) {
                // Critério: Tem a tag certa?
                const isCorrectTag = entity.hasTag(config.tag);
                
                // Se JÁ temos um válido, este é duplicado -> LIXO
                // Se NÃO tem a tag certa -> LIXO
                if (validEntity || !isCorrectTag) {
                    system.run(() => {
                        try {
                            entity.remove();
                        } catch(e) {}
                    });
                } else {
                    validEntity = entity;
                }
            }

            // 2. Se não tem entidade válida, SPAWNAR
            if (!validEntity) {
                // console.warn(`[CLANS] Totem ${config.id} ausente. Spawnando...`);
                system.run(() => {
                    try {
                        const newEntity = dim.spawnEntity(config.typeId, {
                            x: targetLoc.x + 0.5,
                            y: targetLoc.y,
                            z: targetLoc.z + 0.5
                        });
                        newEntity.nameTag = config.name;
                        newEntity.addTag(config.tag);
                        newEntity.addTag('totem_npc'); 
                        
                        // Efeitos permanentes (Imobilidade e Invulnerabilidade)
                        newEntity.addEffect('resistance', 20000000, { amplifier: 255, showParticles: false });
                        newEntity.addEffect('slowness', 20000000, { amplifier: 255, showParticles: false });
                        newEntity.addEffect('weakness', 20000000, { amplifier: 255, showParticles: false });
                    } catch(e) {}
                });
            } else {
                // 3. Se JÁ EXISTE, garantir posição e status
                const currentPos = validEntity.location;
                if (Math.abs(currentPos.x - (targetLoc.x + 0.5)) > 0.5 || 
                    Math.abs(currentPos.y - targetLoc.y) > 0.5 || 
                    Math.abs(currentPos.z - (targetLoc.z + 0.5)) > 0.5) {
                        
                    system.run(() => {
                        validEntity.teleport({
                            x: targetLoc.x + 0.5,
                            y: targetLoc.y,
                            z: targetLoc.z + 0.5
                        }, { dimension: dim });
                    });
                }
                
                if (validEntity.nameTag !== config.name) validEntity.nameTag = config.name;
                validEntity.addEffect('resistance', 20000000, { amplifier: 255, showParticles: false });
                validEntity.addEffect('slowness', 20000000, { amplifier: 255, showParticles: false });
            }
        }
    } catch(e) {
        console.warn(`[CLANS] Erro no loop de manutencao: ${e}`);
    }
}, 600); // Roda a cada 30 segundos

// Comando para verificar clã
world.beforeEvents.chatSend.subscribe((event) => {
    try {
        const player = event.sender;
        if (!player) return;
        
        const message = event.message.trim();
        const msgLow = message.toLowerCase();
        
        // --- COMANDOS PÚBLICOS ---
        if (msgLow === '!clan' || msgLow === '!cla') {
            event.cancel = true;
            let playerClan = null;
            for (const key in CLANS) if (player.hasTag(CLANS[key].tag)) playerClan = CLANS[key];
            if (playerClan) player.sendMessage(`§7Voce esta no cla ${playerClan.color}[${playerClan.name}]`);
            else player.sendMessage('§cVoce nao esta em nenhum cla!');
            return;
        }

        if (msgLow === '!clans') {
            event.cancel = true;
            player.sendMessage('§6=== CLANS ONLINE ===');
            for (const key in CLANS) {
                const clan = CLANS[key];
                const count = world.getAllPlayers().filter(p => p.hasTag(clan.tag)).length;
                player.sendMessage(`${clan.color}[${clan.name}]§7: ${count} online`);
            }
            return;
        }

        if (msgLow === '!loja' || msgLow === '!shop') {
            event.cancel = true;
            system.run(() => {
                showShopWelcomeMenu(player);
            });
            return;
        }

        if (message.startsWith('! ')) { // Chat do clã
            event.cancel = true;
            let content = message.substring(1).trim();
            if (content.length === 0) return;
            let playerClan = null;
            for (const key in CLANS) if (player.hasTag(CLANS[key].tag)) playerClan = CLANS[key];
            if (!playerClan) return player.sendMessage('§cVoce nao tem um cla!');
            const members = world.getAllPlayers().filter(p => p.hasTag(playerClan.tag));
            for (const m of members) m.sendMessage(`${playerClan.color}[CLAN] ${player.name}: §f${content}`);
            return;
        }
    
        if (message.startsWith('!saldo') || message.startsWith('!balance')) {
            event.cancel = true;
            const objective = world.scoreboard.getObjective('coins');
            const score = objective?.getScore(player) ?? 0;
            
            player.sendMessage(`§e--------------------------------`);
            player.sendMessage(`§fNome: §b${player.name}`);
            player.sendMessage(`§fID: §7${player.id}`);
            player.sendMessage(`§6Saldo (Script): §a${score}`);
            player.sendMessage(`§e--------------------------------`);
            console.warn(`[DEBUG] !saldo: ${player.name} (${player.id}) = ${score}`);
            return;
        }

        // COMANDO: PAGAR / DAR MOEDAS (Player x Player)
        // Uso: !darmoedas "Nome" valor
        if (message.startsWith('!darmoedas') || message.startsWith('!pagar') || message.startsWith('!pay')) {
            event.cancel = true;
            
            const args = message.match(/"([^"]+)"|'([^']+)'|(\S+)/g);
            if (!args || args.length < 3) {
                player.sendMessage('§cUso incorreto! Digite: !darmoedas "Nome do Jogador" valor');
                return;
            }

            let targetName = args[1].replace(/"/g, '').replace(/'/g, ''); 
            const amount = parseInt(args[2]);

            if (isNaN(amount) || amount <= 0) {
                player.sendMessage('§cValor invalido!');
                return;
            }

            // Verificar saldo do pagador
            const objective = world.scoreboard.getObjective('coins');
            const balance = objective?.getScore(player) ?? 0;
            
            if (balance < amount) {
                player.sendMessage(`§cVoce nao tem coins suficientes! Saldo: ${balance}`);
                return;
            }

            // Procurar alvo
            const targetPlayer = world.getAllPlayers().find(p => p.name === targetName);
            if (!targetPlayer) {
                player.sendMessage(`§cJogador "§f${targetName}§c" nao encontrado online!`);
                return;
            }

            // Transação
            if (objective) {
                objective.addScore(player, -amount);
                objective.addScore(targetPlayer, amount);
                
                player.sendMessage(`§aVoce enviou §e${amount} Coins §apara §f${targetName}§a.`);
                targetPlayer.sendMessage(`§aVoce recebeu §e${amount} Coins §ade §f${player.name}§a.`);
                console.warn(`[ECONOMIA] ${player.name} enviou ${amount} para ${targetName}`);
            }
            return;
        }

        // COMANDO ADMIN: CRIAR MOEDAS
        // Uso: !addmoedas "Nome" valor
        if (message.startsWith('!addmoedas') || message.startsWith('!addcoins')) {
            event.cancel = true;
            
            if (!checkAdmin(player)) {
                player.sendMessage('§cApenas admins podem criar moedas!');
                return;
            }

            const args = message.match(/"([^"]+)"|'([^']+)'|(\S+)/g);
            if (!args || args.length < 3) {
                player.sendMessage('§cUso: !addmoedas "Nome" valor');
                return;
            }

            let targetName = args[1].replace(/"/g, '').replace(/'/g, '');
            const amount = parseInt(args[2]);

            const targetPlayer = world.getAllPlayers().find(p => p.name === targetName);
            if (!targetPlayer) {
                player.sendMessage(`§cJogador "§f${targetName}§c" nao encontrado online!`);
                return;
            }

            const objective = world.scoreboard.getObjective('coins');
            if (objective) {
                objective.addScore(targetPlayer, amount);
                player.sendMessage(`§a[ADMIN] Voce adicionou §e${amount} Coins §apara §f${targetName}§a.`);
                targetPlayer.sendMessage(`§aVoce recebeu §e${amount} Coins §ada administracao!`);
                console.warn(`[ECONOMIA-ADMIN] ${player.name} criou ${amount} para ${targetName}`);
            }
            return;
        }

    //------------------------------------------
    // TELEPORTE PARA BASE
    //------------------------------------------
    if (message === '!base') {
         // Cancelar envio global
         event.cancel = true;

        // Descobrir clã do jogador
        let playerClan = null;
        for (const clanKey in CLANS) {
            const clan = CLANS[clanKey];
            if (player.hasTag(clan.tag)) {
                playerClan = clan;
                break;
            }
        }
        
        if (!playerClan) {
            player.sendMessage('§cVoce nao tem um cla para ir a base!');
            return;
        }

        // Verificar custo (100 coins)
        try {
            const objective = world.scoreboard.getObjective('coins');
            if (objective) {
                const balance = objective.getScore(player) ?? 0;
                const cost = 100;
                
                if (balance < cost) {
                    player.sendMessage(`§cVoce precisa de ${cost} Coins para teleportar! Seu saldo: ${balance} Coins`);
                    return;
                }
                
                // Descontar valor
                objective.addScore(player, -cost);
                player.sendMessage(`§eFoi descontado ${cost} Coins do seu saldo.`);
            }
        } catch (e) {}
        
        const base = playerClan.base;
        const dimensionName = playerClan.dimension || 'overworld';
        
        // Teleportar o jogador
        system.run(() => {
            player.teleport({ x: base.x + 2, y: base.y + 0.5, z: base.z + 2 }, { dimension: world.getDimension(dimensionName) });
            player.sendMessage(`${playerClan.color}[CLAN] §aVoce foi teleportado para a base ${playerClan.name}!`);
        });
    }


    if (message === '!saldo' || message === '!money') {
        event.cancel = true;
        
        try {
            const objective = world.scoreboard.getObjective('coins');
            const score = objective?.getScore(player) ?? 0;
            player.sendMessage(`§6=== SEU SALDO ===\n§fVoce tem: §e${score} Coins`);
        } catch (e) {
            player.sendMessage('§cErro ao verificar saldo.');
        }
    }

        if (message.startsWith('!pagar ')) {
            event.cancel = true;
            const args = message.split(' ');
            if (args.length < 3) return player.sendMessage('§cUso correto: !pagar @JOGADOR <QUANTIDADE>');
            const targetName = args[1].replace('@', '').replace(/"/g, '');
            const amount = parseInt(args[2]);
            if (isNaN(amount) || amount <= 0) return player.sendMessage('§cQuantidade invalida!');
            const objective = world.scoreboard.getObjective('coins');
            const balance = objective?.getScore(player) ?? 0;
            if (balance < amount) return player.sendMessage(`§cVoce nao tem coins suficientes! Saldo: ${balance} Coins`);
            const targetPlayer = world.getAllPlayers().find(p => p.name === targetName);
            if (!targetPlayer) return player.sendMessage(`§cJogador "${targetName}" nao encontrado ou offline.`);
            system.run(() => {
                objective.addScore(player, -amount);
                objective.addScore(targetPlayer, amount);
                player.sendMessage(`§aPagamento de ${amount} Coins enviado para ${targetName}!`);
                targetPlayer.sendMessage(`§aVoce recebeu ${amount} Coins de ${player.name}!`);
            });
            return;
        }

        // --- COMANDOS DE DEBUG (TOTENS) ---
    if (msgLow.startsWith('!tpbase ')) {
        event.cancel = true;
        if (!checkAdmin(player)) return;
        const clanKey = msgLow.split(' ')[1];
        const clan = CLANS[clanKey];
        if (!clan) {
            player.sendMessage('§cClã inválido!');
            return;
        }
        player.teleport(clan.base, { dimension: world.getDimension(clan.dimension || 'overworld') });
        player.sendMessage(`§aTeleportado para a base do clã ${clanKey}`);
        return;
    }

    if (msgLow === '!findtotems') {
        event.cancel = true;
        if (!checkAdmin(player)) return;
        player.sendMessage('§e[DEBUG] Buscando totens no mundo...');
        for (const config of TOTEM_CONFIG) {
            const dim = world.getDimension(config.dimension);
            const entities = dim.getEntities({ typeId: config.typeId });
            player.sendMessage(`§7- ${config.id}: ${entities.length} encontrados em ${config.dimension} (${config.location.x}, ${config.location.y}, ${config.location.z})`);
        }
        return;
    }

    if (msgLow === '!spawntotems') {
        event.cancel = true;
        if (!checkAdmin(player)) return;
        player.sendMessage('§e[DEBUG] Forçando spawn de todos os totens...');
        maintenanceLoop();
        player.sendMessage('§a[DEBUG] Manutenção executada.');
        return;
    }

        // COMANDO ADMIN: DEFINIR BASE (!setbase red)
        if (msgLow.startsWith('!setbase ')) {
            event.cancel = true;
            
            if (!checkAdmin(player)) {
                
                player.sendMessage('§cApenas admins podem definir bases!');
                return;
            }

            const args = msgLow.split(' ');
            if (args.length < 2) {
                player.sendMessage('§cUso: !setbase <red|blue|green|yellow>');
                return;
            }
            
            const clanKey = args[1].toLowerCase();
            if (!CLANS[clanKey]) {
                player.sendMessage('§cClã inválido! Use: red, blue, green, yellow');
                return;
            }

            const newBase = {
                x: Math.floor(player.location.x),
                y: Math.floor(player.location.y),
                z: Math.floor(player.location.z)
            };
            const newDim = player.dimension.id; // minecraft:overworld

            // Salvar na memória do mundo (PERSISTÊNCIA)
            const dataToSave = JSON.stringify({ base: newBase, dimension: newDim });
            world.setDynamicProperty(`clan_base_${clanKey}`, dataToSave);
            
            // Atualizar tempo real
            CLANS[clanKey].base = newBase;
            CLANS[clanKey].dimension = newDim;
            
            // Atualizar Totem Config também se necessário (recarregar script idealmente, mas atualiza RAM)
            const totem = TOTEM_CONFIG.find(t => t.id === `${clanKey}_totem`);
            if (totem) {
                totem.location = newBase;
                totem.dimension = newDim.replace('minecraft:', '');
            }

            player.sendMessage(`§aBase do clã ${CLANS[clanKey].name} definida para: ${newBase.x}, ${newBase.y}, ${newBase.z} (${newDim})`);
            console.warn(`[CLANS] Base ${clanKey} atualizada por ${player.name}`);
            return;
        }

        // ==========================================
        // COMANDOS DE ADMIN (CONSOLIDADOS AQUI)
        // ==========================================


        if (message === '!clean') {
            event.cancel = true;
            if (!checkAdmin(player)) return player.sendMessage('§cAcesso negado.');
            
            player.sendMessage('§e[CLEAN] Buscando NPCs em um raio de 100 blocos...');
            
            try {
                const npcs = player.dimension.getEntities({ 
                    typeId: 'minecraft:npc',
                    location: player.location,
                    maxDistance: 100
                });
                
                player.sendMessage(`§e[CLEAN] Encontrados ${npcs.length} NPCs`);
                
                let removed = 0;
                for (const npc of npcs) {
                    try {
                        const loc = npc.location;
                        player.sendMessage(`§7- Removendo: "${npc.nameTag}" em (${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)})`);
                        npc.remove();
                        removed++;
                    } catch(e) {
                        player.sendMessage(`§c- Erro: ${e}`);
                    }
                }
                
                player.sendMessage(`§a[CLEAN] ${removed} NPCs removidos!`);
                player.sendMessage(`§7Agora spawne um novo NPC manualmente com: /summon npc`);
                
            } catch(e) {
                player.sendMessage(`§cErro: ${e}`);
            }
            return;
        }
        
        if (message === '!cleanall') {
            event.cancel = true;
            if (!checkAdmin(player)) return player.sendMessage('§cAcesso negado.');
            
            player.sendMessage('§e[CLEANALL] Iniciando limpeza automática...');
            player.sendMessage('§7Você será teleportado para cada local de NPC');
            
            // Salvar posição original
            const originalPos = player.location;
            const originalDim = player.dimension;
            
            // Lista de locais onde tem NPCs
            const locations = [
                { dim: 'overworld', pos: CLANS.blue.base, name: 'Base BLUE' },
                { dim: 'overworld', pos: CLANS.green.base, name: 'Base GREEN' },
                { dim: 'overworld', pos: CLANS.yellow.base, name: 'Base YELLOW' },
                { dim: 'nether', pos: CLANS.red.base, name: 'Base RED (Nether)' }
            ];
            
            let currentIndex = 0;
            let totalRemoved = 0;
            
            function cleanNextLocation() {
                if (currentIndex >= locations.length) {
                    // Terminou - voltar para posição original
                    player.teleport(originalPos, { dimension: originalDim });
                    player.sendMessage(`§a[CLEANALL] Concluído! ${totalRemoved} NPCs removidos`);
                    return;
                }
                
                const loc = locations[currentIndex];
                const dim = world.getDimension(loc.dim);
                
                player.sendMessage(`§7[${currentIndex + 1}/${locations.length}] Limpando ${loc.name}...`);
                
                // Teleportar para o local
                player.teleport(loc.pos, { dimension: dim });
                
                // Aguardar chunk carregar e limpar
                system.runTimeout(() => {
                    try {
                        const npcs = dim.getEntities({
                            typeId: 'minecraft:npc',
                            location: loc.pos,
                            maxDistance: 10
                        });
                        
                        player.sendMessage(`§7  Encontrados ${npcs.length} NPCs`);
                        
                        // REMOVER TODOS os NPCs
                        for (const npc of npcs) {
                            try {
                                npc.remove();
                                totalRemoved++;
                            } catch(e) {}
                        }
                        
                        player.sendMessage(`§a  ${npcs.length} NPCs removidos`);
                        

                        
                    } catch(e) {
                        player.sendMessage(`§c  Erro: ${e}`);
                    }
                    
                    // Próximo local
                    currentIndex++;
                    system.runTimeout(cleanNextLocation, 60); // 3 segundos entre cada local
                    
                }, 60); // 3 segundos para chunk carregar
            }
            
            // Iniciar limpeza
            cleanNextLocation();
            return;
        }

        if (message.startsWith('!setskin ')) {
            event.cancel = true;
            
            if (!checkAdmin(player)) {
                player.sendMessage('§cVoce nao tem permissao de Admin!');
                return;
            }

            const args = message.split(' ');
            if (args.length < 2) return player.sendMessage('§cUso: !setskin <id>');

            const index = parseInt(args[1]);
            
            // Busca QUALQUER entidade perto para analisar
            const entities = player.dimension.getEntities({ 
                location: player.location, 
                maxDistance: 15
            });

            // Filtra pela que parece ser o NPC
            const target = entities.find(e => e.typeId === 'minecraft:npc' || e.hasTag('totem_npc') || e.hasTag('clan_shop'));

            if (target) {
                // Tenta pegar o componente de várias formas
                const npcComp = target.getComponent('minecraft:npc') || target.getComponent('npc');
                
                if (npcComp) { 
                    try {
                        npcComp.skinIndex = index; 
                        player.sendMessage(`§a[DEBUG] Entity: ${target.typeId}`);
                        player.sendMessage(`§aSkin alterada para ${index}!`); 
                    } catch (err) {
                        player.sendMessage(`§cErro ao aplicar skin: ${err}`);
                    }
                } else {
                    player.sendMessage(`§cERRO: Entity ${target.typeId} nao tem o componente 'minecraft:npc'.`);
                    player.sendMessage(`§7Tags: ${target.getTags().join(', ')}`);
                }
            } else {
                player.sendMessage('§cErro: Nenhum NPC (ou entidade com tag de clã) encontrado perto de voce.');
            }
            return;
        }

        if (message === '!checkadmin') {
            event.cancel = true;
            const isAdmin = checkAdmin(player);
            player.sendMessage('§e=== VERIFICACAO DE ADMIN ===');
            player.sendMessage(`§7Status Admin: ${isAdmin ? '§aVERDADEIRO' : '§cFALSO'}`);
            player.sendMessage(`§7Suas tags: §f${player.getTags().join(', ')}`);
            player.sendMessage(`§7Para ser admin, adicione uma tag com: §f/tag @s add admin`);
            return;
        }

        if (message === '!debug') {
            event.cancel = true;
            if (!checkAdmin(player)) return;
            player.sendMessage('§eAuditando Clã NPCs:');
            player.sendMessage(`§7- NPCs Totais: ${player.dimension.getEntities({typeId:'minecraft:npc'}).length}`);
            player.sendMessage(`§7- Tags Admin: §f${player.getTags().join(', ')}`);
            player.sendMessage(`§7- Localização: §f${Math.floor(player.location.x)}, ${Math.floor(player.location.y)}, ${Math.floor(player.location.z)}`);
            return;
        }

        if (message.startsWith('!setclanall ')) {
            event.cancel = true;
            if (!checkAdmin(player)) return;
            const targetClanKey = message.split(' ')[1]?.toLowerCase();
            if (!CLANS[targetClanKey]) return player.sendMessage('§cClã inválido.');
            const newClan = CLANS[targetClanKey];
            for (const p of world.getAllPlayers()) {
                for (const key in CLANS) if (p.hasTag(CLANS[key].tag)) p.removeTag(CLANS[key].tag);
                p.addTag(newClan.tag);
                p.nameTag = `${newClan.color}[${newClan.name}]\n${p.name}`;
            }
            player.sendMessage(`§aTodos movidos para ${newClan.name}!`);
            return;
        }

        if (message.startsWith('!setclan ')) {
            event.cancel = true;
            if (!checkAdmin(player)) {
                player.sendMessage('§c[ERRO] Voce precisa ser Admin para usar este comando!');
                return;
            }
            
            const args = message.match(/!setclan\s+("([^"]+)"|(\S+))\s+(\w+)/);
            if (!args) {
                player.sendMessage('§cUso correto: !setclan "Nick" <clan>');
                player.sendMessage('§7Exemplo: !setclan "SerafimM2025" red');
                player.sendMessage('§7Clans disponiveis: red, blue, green, yellow');
                return;
            }
            
            const targetName = args[2] || args[3];
            const clanKey = args[4].toLowerCase();
            
            if (!CLANS[clanKey]) {
                player.sendMessage(`§c[ERRO] Cla "${clanKey}" invalido!`);
                player.sendMessage('§7Clans disponiveis: red, blue, green, yellow');
                return;
            }
            
            const target = world.getAllPlayers().find(p => p.name === targetName);
            if (!target) {
                player.sendMessage(`§c[ERRO] Jogador "${targetName}" nao encontrado ou offline!`);
                player.sendMessage('§7Jogadores online:');
                world.getAllPlayers().forEach(p => player.sendMessage(`§7- ${p.name}`));
                return;
            }
            
            const newClan = CLANS[clanKey];
            for (const key in CLANS) if (target.hasTag(CLANS[key].tag)) target.removeTag(CLANS[key].tag);
            target.addTag(newClan.tag);
            target.nameTag = `${newClan.color}[${newClan.name}]\n${target.name}`;
            
            player.sendMessage(`§a[SUCESSO] ${targetName} foi movido para o cla ${newClan.color}${newClan.name}§a!`);
            target.sendMessage(`§aVoce foi movido para o cla ${newClan.color}${newClan.name}§a!`);
            return;
        }

        // COMANDO ALTERNATIVO: !moveclan (sintaxe mais simples)
        if (message.startsWith('!moveclan ')) {
            event.cancel = true;
            
            if (!checkAdmin(player)) {
                player.sendMessage('§c[ERRO] Voce precisa ser Admin!');
                return;
            }
            
            // Sintaxe: !moveclan NomeDoJogador red
            const parts = message.split(' ');
            if (parts.length < 3) {
                player.sendMessage('§cUso: !moveclan NomeDoJogador red/blue/green/yellow');
                player.sendMessage('§7Exemplo: !moveclan SerafimM2025 red');
                return;
            }
            
            const targetName = parts[1];
            const clanKey = parts[2].toLowerCase();
            
            if (!CLANS[clanKey]) {
                player.sendMessage(`§c[ERRO] Cla invalido: ${clanKey}`);
                player.sendMessage('§7Use: red, blue, green ou yellow');
                return;
            }
            
            const target = world.getAllPlayers().find(p => p.name === targetName);
            if (!target) {
                player.sendMessage(`§c[ERRO] Jogador "${targetName}" nao encontrado!`);
                player.sendMessage('§7Jogadores online:');
                world.getAllPlayers().forEach(p => player.sendMessage(`§7- ${p.name}`));
                return;
            }
            
            const newClan = CLANS[clanKey];
            
            // DEBUG: Mostrar tags antes
            const tagsBefore = target.getTags().filter(t => t.includes('clan'));
            player.sendMessage(`§7[DEBUG] Tags ANTES: ${tagsBefore.join(', ')}`);
            console.warn(`[CLANS] Tags ANTES para ${targetName}: ${target.getTags().join(', ')}`);
            
            // Usar métodos nativos do Minecraft (mais confiáveis)
            system.run(() => {
                try {
                    // Remover todas as tags de clã antigas
                    for (const key in CLANS) {
                        if (target.hasTag(CLANS[key].tag)) target.removeTag(CLANS[key].tag);
                    }
                    
                    // Adicionar nova tag e atualizar nome
                    target.addTag(newClan.tag);
                    target.nameTag = `${newClan.color}[${newClan.name}]\n${target.name}`;
                    
                    player.sendMessage(`§a[OK] ${targetName} -> ${newClan.color}${newClan.name}`);
                    target.sendMessage(`§aVoce agora e do cla ${newClan.color}${newClan.name}§a!`);
                    
                    console.warn(`[CLANS] ${targetName} movido para ${clanKey} com sucesso.`);
                } catch (error) {
                    player.sendMessage(`§c[ERRO] Falha ao mudar cla: ${error}`);
                    console.warn(`[CLANS] ERRO ao mudar cla: ${error}`);
                }
            });
            return;
        }

    } catch (e) {
        console.warn('[CLANS] Erro no processamento de comando:', e);
    }
});





//------------------------------------------
// LOJA DO CLÃ (SISTEMA DE CATEGORIAS)
//------------------------------------------

// 1. Mensagem de Boas-Vindas e Doação
function showShopWelcomeMenu(player) {
    const form = new ActionFormData()
        .title('§l§6LOJA DO CLÃ')
        .body(
            '§fSaudacoes! Trago mercadorias raras de terras distantes.\n' +
            '§7Aceito apenas Coins, uma moeda concedida daqueles que fortalecem a existencia deste mundo.\n\n' +
            '§ePrecisamos de recursos para manter este reino de pe e online.\n' +
            '§fOferendas (Pix) de §aR$ 1,00§f sao recompensadas com §e1.000 Coins§f.\n\n' +
            '§7Fale com um ADM para fazer sua oferenda.'
        )
        .button('§l§aVER PRODUTOS\n§r§7Abrir Loja', 'textures/ui/store_home_icon')
        .button('§cSair', 'textures/ui/cancel');

    form.show(player).then((response) => {
        if (response.canceled || response.selection === 1) return;
        
        // Se escolheu acessar loja
        if (response.selection === 0) {
            system.run(() => openClanShopMainMenu(player));
        }
    }).catch(e => {
        console.warn('[CLANS] Erro ao abrir Welcome Menu:', e);
    });
}

// 2. Menu Principal (Categorias)
function openClanShopMainMenu(player) {
    const form = new ActionFormData()
        .title('§l§6LOJA DO CLÃ')
        .body('§7Selecione uma categoria:');

    for (const category of SHOP_CATEGORIES) {
        form.button(category.name, category.icon);
    }

    form.show(player).then((response) => {
        if (response.canceled) return;
        
        const selectedCategory = SHOP_CATEGORIES[response.selection];
        // Abre o submenu da categoria escolhida
        system.run(() => {
             openClanShopCategory(player, selectedCategory);
        });
    }).catch(e => {
        console.warn('[CLANS] Erro ao abrir menu principal:', e);
    });
}

// 3. Submenu (Lista de Itens)
function openClanShopCategory(player, category) {
    // Debug
    console.warn(`[CLANS] Abrindo categoria: ${category.id}`);
    
    const form = new ActionFormData()
        .title(`§l${category.name.replace('\n', ' - ')}`) 
        .body(`§7Saldo: §e${getScore(player)} Coins\n§7Escolha um item para comprar:`);

    for (const item of category.items) {
        form.button(`${item.name}\n§e${item.price} Coins`, item.icon);
    }
    
    form.button('§cVoltar', 'textures/ui/arrow_dark_left_stretch');

    form.show(player).then((response) => {
        if (response.canceled) return;

        if (response.selection === category.items.length) {
            system.run(() => openClanShopMainMenu(player));
            return;
        }
        
        const selectedItem = category.items[response.selection];
        buyItem(player, selectedItem, category);

    }).catch(e => {
        console.warn('[CLANS] Erro ao abrir categoria:', e);
    });
}

function getScore(player) {
    try {
        const objective = world.scoreboard.getObjective('coins');
        return objective?.getScore(player) ?? 0;
    } catch { return 0; }
}

// 4. Lógica de Compra
function buyItem(player, item, category) {
    const objective = world.scoreboard.getObjective('coins');
    const balance = objective?.getScore(player) ?? 0;
    
    console.warn(`[DEBUG] Tentativa de compra: Player=${player.name}, Saldo=${balance}, Preco=${item.price}`);

    if (balance < item.price) {
        player.sendMessage(`§cVoce nao tem coins suficientes! Precisa de ${item.price}.`);
        system.run(() => openClanShopCategory(player, category));
        return;
    }
    
    objective.addScore(player, -item.price);
    
    const commands = item.command.split('\n');
    for (const cmd of commands) {
        if (cmd.trim().length > 0) {
            player.runCommand(cmd.trim());
        }
    }
    
    player.sendMessage(`§aVoce comprou §f${item.name} §apor §e${item.price} Coins§a!`);
    
    system.run(() => openClanShopCategory(player, category));
}

// 5. Listener de Interação
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const target = event.target;
    
    // PROTEÇÃO DE TOTEM (Anti-Roubo)
    if (target.hasTag('totem_npc')) {
        event.cancel = true;
        // Opcional: Avisar que é protegido
        // event.player.sendMessage('§cEste Totem é protegido!');
        return;
    }

    if (target.hasTag('clan_shop') || target.nameTag === '§6§lLOJA DO CLÃ') {
        event.cancel = true; 
        
        system.run(() => {
            if (!target.hasTag('clan_shop')) target.addTag('clan_shop');
            // AGORA ABRE O MENU DE BOAS-VINDAS PRIMEIRO
            showShopWelcomeMenu(event.player);
        });
    }
});

//---------------------------------------------------------
// SISTEMA DE MANUTENÇÃO UNIFICADA
//---------------------------------------------------------
function maintenanceLoop() {
    try {
        const allPlayers = world.getAllPlayers();
        
        // --- 1. LIMPEZA DE PLAYERS (EFEITOS E TAGS) ---
        const badTags = ['totem_red', 'totem_blue', 'totem_green', 'totem_yellow'];
        for (const p of allPlayers) {
            for (const tag of badTags) if (p.hasTag(tag)) p.removeTag(tag);
            
            const slowness = p.getEffect('slowness');
            if (slowness && slowness.amplifier >= 250) p.removeEffect('slowness');
            
            const resistance = p.getEffect('resistance');
            if (resistance && resistance.amplifier >= 250) p.removeEffect('resistance');

            if (p.location.y < -64) {
                p.teleport({ x: 0, y: 100, z: 0 });
                p.sendMessage('§e[SISTEMA] Voce foi resgatado do limbo!');
            }
        }

        // --- 2. MANUTENÇÃO DE ENTIDADES (TOTENS E LOJA) ---
        for (const config of TOTEM_CONFIG) {
            try {
                const dim = world.getDimension(config.dimension);
                
                // --- NOVO: PEDESTAL DE BEDROCK E LIMPEZA DE ÁREA ---
                const loc = config.location;
                const x = Math.floor(loc.x);
                const y = Math.floor(loc.y);
                const z = Math.floor(loc.z);

                // Criar base 3x3 de bedrock
                safeRunCommand(dim, `fill ${x - 1} ${y - 1} ${z - 1} ${x + 1} ${y - 1} ${z + 1} bedrock`);
                
                // Limpar área 3x3x3 de ar ao redor do totem
                safeRunCommand(dim, `fill ${x - 1} ${y} ${z - 1} ${x + 1} ${y + 2} ${z + 1} air`);

                // Tentar garantir a entidade na posição exata
                ensureEntityAtExactPosition(
                    dim,
                    config.typeId,
                    [config.tag, 'totem_npc'],
                    config.name,
                    config.location,
                    (entity) => {
                        // Setup extra
                        if (!entity.getEffect('resistance')) entity.addEffect('resistance', 20000000, { amplifier: 255, showParticles: false });
                        if (!entity.getEffect('slowness')) entity.addEffect('slowness', 20000000, { amplifier: 255, showParticles: false });
                        if (config.id === 'shop') {
                            if (!entity.hasTag('clan_shop')) entity.addTag('clan_shop');
                        }
                    }
                );
            } catch (e) {
                console.warn(`[CLANS] Erro crítico manutenção ${config.id}: ${e}`);
            }
        }
        console.warn(`[CLANS] Manutencao de rotina concluida - ${allPlayers.length} jogadores online.`);
    } catch (e) {}
}

// Loop de Segurança e Manutenção (1 minuto)
system.runInterval(maintenanceLoop, 1200);

// Substituindo o antigo ensureEntityAtExactPosition para ser mais silencioso e seguro
function ensureEntityAtExactPosition(dimension, typeId, selectorTags, expectedNameTag, expectedPos, extraSetupFn) {
    try {
        const candidates = dimension.getEntities({ 
            location: expectedPos, 
            maxDistance: 6 
        }).filter(e => e.typeId === typeId || selectorTags.some(t => e.hasTag(t)));

        // Remover duplicatas
        if (candidates.length > 1) {
            for (let i = 1; i < candidates.length; i++) {
                try { candidates[i].remove(); } catch(err) {}
            }
        }

        let primary = candidates[0];

        if (!primary) {
            // Tentar spawnar (Pode falhar se o chunk não estiver carregado)
            try {
                console.warn(`[CLANS] Spawnando ${typeId} em ${expectedPos.x}, ${expectedPos.y}, ${expectedPos.z}`);
                primary = dimension.spawnEntity(typeId, {
                    x: expectedPos.x + 0.5,
                    y: expectedPos.y,
                    z: expectedPos.z + 0.5
                });
            } catch (e) {
                // Se der erro de chunk, apenas sai e espera o próximo ciclo
                return null;
            }
        }

        // Atualizar estado
        if (primary && primary.isValid()) {
            if (expectedNameTag) primary.nameTag = expectedNameTag;
            for (const t of selectorTags) if (t && !primary.hasTag(t)) primary.addTag(t);
            
            const loc = primary.location;
            const dist = Math.sqrt((loc.x - (expectedPos.x + 0.5))**2 + (loc.z - (expectedPos.z + 0.5))**2);
            if (dist > 1 || Math.abs(loc.y - expectedPos.y) > 1 || loc.y < -60) {
                try {
                    primary.teleport({ x: expectedPos.x + 0.5, y: expectedPos.y, z: expectedPos.z + 0.5 }, { dimension });
                } catch(e) {}
            }

            if (extraSetupFn) extraSetupFn(primary);
        }

        return primary;
    } catch (e) {
        return null;
    }
}

// Helper universal para comandos (compatibilidade de versões)
function safeRunCommand(dimension, command) {
    try {
        if (dimension.runCommandAsync) {
            return dimension.runCommandAsync(command).catch(e => {
                // Silencioso para comandos de rotina, mas loga erro de sintaxe se necessário
            });
        } else if (dimension.runCommand) {
            return dimension.runCommand(command);
        }
    } catch (e) {}
}




// Função auxiliar para carregar ticking areas (Garantir carregamento do chunk)
function tryAddTickingArea(dimension, location, name) {
    try {
        const x = Math.floor(location.x);
        const y = Math.floor(location.y);
        const z = Math.floor(location.z);
        safeRunCommand(dimension, `tickingarea remove ${name}`);
        safeRunCommand(dimension, `tickingarea add circle ${x} ${y} ${z} 4 ${name}`);
    } catch (e) {}
}

// Loop para Spawnar Partículas (Auras) dos Totens
system.runInterval(() => {
    for (const config of TOTEM_CONFIG) {
        if (!config.aura) continue;
        try {
            const dim = world.getDimension(config.dimension);
            // Spawnar múltiplas partículas com variação aleatória para criar uma "nuvem"
            for (let i = 0; i < 5; i++) {
                dim.spawnParticle(config.aura, {
                    x: config.location.x + 0.5 + (Math.random() - 0.5) * 1.5,
                    y: config.location.y + 0.2 + Math.random() * 2.5,
                    z: config.location.z + 0.5 + (Math.random() - 0.5) * 1.5
                });
            }
        } catch(e) {}
    }
}, 10);

//------------------------------------------
// INICIALIZAÇÃO DO SERVIDOR
//------------------------------------------
system.runTimeout(() => {
    console.warn('[CLANS] Iniciando carregamento de areas...');
    for (const config of TOTEM_CONFIG) {
        const dim = world.getDimension(config.dimension);
        tryAddTickingArea(dim, config.location, `clan_${config.tag}`);
    }
    // Agendar a primeira manutenção para 10 segundos depois (200 ticks)
    // Assim o totem e o pedestal aparecem logo no início sem esperar 1 minuto
    system.runTimeout(() => {
        maintenanceLoop();
    }, 200);
}, 100);

//------------------------------------------
// PROTEÇÃO DE CONSTRUÇÃO (CLÃ AMARELO)
//------------------------------------------

// Helper para verificar se está na base
function isInClanBase(player, clanKey) {
    try {
        // Verificação básica
        if (!player) {
            console.warn(`[CLANS] isInClanBase: player is null/undefined`);
            return false;
        }
        
        const dimension = player.dimension;
        if (!dimension) {
            console.warn(`[CLANS] isInClanBase: dimension is null/undefined`);
            return false;
        }
        
        // Procura totem do clã num raio
        const totems = dimension.getEntities({
            location: player.location,
            maxDistance: CLAN_BASE_RADIUS,
            tags: [`totem_${clanKey}`]
        });
        
        return totems.length > 0;
    } catch (e) {
        return false;
    }
}

// Bloquear Quebra de Blocos nas Bases (Proteção de Clã)
world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const player = event.player;
    
    // Se for admin, libera tudo
    if (checkAdmin(player)) return;

    // Verificar se está na base de ALGUM clã
    for (const key in CLANS) {
        if (isInClanBase(player, key)) {
            const clan = CLANS[key];
            
            // Se NÃO for membro deste clã específico, bloqueia
            if (!player.hasTag(clan.tag)) {
                event.cancel = true;
                player.sendMessage(`§cEste territorio pertence ao cla ${clan.color}${clan.name}§c! Apenas membros podem quebrar blocos aqui.`);
                return;
            }
        }
    }
});

// Bloquear Colocação de Blocos nas Bases (Proteção de Clã)
world.beforeEvents.playerPlaceBlock.subscribe((event) => {
    const player = event.player;
    
    if (checkAdmin(player)) return;

    // Verificar se está na base de ALGUM clã
    for (const key in CLANS) {
        if (isInClanBase(player, key)) {
            const clan = CLANS[key];
            
            // Se NÃO for membro deste clã específico, bloqueia
            if (!player.hasTag(clan.tag)) {
                event.cancel = true;
                player.sendMessage(`§cEste territorio pertence ao cla ${clan.color}${clan.name}§c! Apenas membros podem colocar blocos aqui.`);
                return;
            }
        }
    }
});

console.warn('[CLANS] Script main.js carregado');

// (Debug movido para o chat consolidado)

// Bloquear Interação com Blocos nas Bases (Baús, Portas, Alavancas)
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const player = event.player;
    
    if (checkAdmin(player)) return;

    // Verificar se está na base de ALGUM clã
    for (const key in CLANS) {
        if (isInClanBase(player, key)) {
            const clan = CLANS[key];
            
            // Se NÃO for membro deste clã específico, bloqueia
            if (!player.hasTag(clan.tag)) {
                event.cancel = true;
                player.sendMessage(`§cVisitantes nao podem interagir com objetos na base do cla ${clan.color}${clan.name}§c!`);
                return;
            }
        }
    }
});
