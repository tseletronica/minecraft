import { world, system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { SHOP_CATEGORIES } from './config.js';

// Configuração dos clãs e coordenadas das bases (Onde os totens SEMPRE devem estar)
const CLANS = {
    red: { 
        name: 'RED', 
        color: '§c', 
        tag: 'clan_red',
        base: { x: 1000, y: 100, z: 1000 }
    },
    blue: { 
        name: 'BLUE', 
        color: '§9', 
        tag: 'clan_blue',
        base: { x: -1000, y: 100, z: 1000 }
    },
    green: { 
        name: 'GREEN', 
        color: '§a', 
        tag: 'clan_green',
        base: { x: -1000, y: 100, z: -1000 }
    },
    yellow: { 
        name: 'YELLOW', 
        color: '§e', 
        tag: 'clan_yellow',
        base: { x: 1000, y: 100, z: -1000 }
    }
};

const SHOP_LOCATION = { x: -43, y: 67, z: 54 }; // Local da Loja do Clã
const CLAN_BASE_RADIUS = 50; // Raio de proteção do totem

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
world.beforeEvents.entityHurt.subscribe((event) => {
    const victim = event.hurtEntity;
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
            player.runCommandAsync('permission set @s member').catch(() => {});
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
// EFEITOS PASSIVOS (VISÃO NOTURNA - CLÃ GREEN E DEFESA NOS TOTENS)
//------------------------------------------
system.runInterval(() => {
    try {
        const allPlayers = world.getAllPlayers();
        
        // VISÃO NOTURNA (CLÃ GREEN)
        const greenPlayers = allPlayers.filter(p => p.hasTag(CLANS.green.tag));
        for (const player of greenPlayers) {
            // Verificar se já tem o efeito e quanto tempo falta
            const effect = player.getEffect('night_vision');
            
            // Se não tiver efeito OU se faltar menos de 220 ticks (11 segundos), reaplicar
            if (!effect || effect.duration < 220) {
                // Aplica por 20 minutos (24000 ticks) para evitar ficar reaplicando toda hora
                // Isso deve resolver o "piscar" da tela
                player.addEffect('night_vision', 24000, {
                    amplifier: 0,
                    showParticles: false
                });
            }
        }
        
        // DEFESA NOS TOTENS (TODOS OS CLÃS) - Resistance 255
        for (const player of allPlayers) {
            let nearOwnTotem = false;
            
            for (const clanKey in CLANS) {
                const clan = CLANS[clanKey];
                if (player.hasTag(clan.tag) && isInClanBase(player, clanKey)) {
                    nearOwnTotem = true;
                    
                    const resistance = player.getEffect('resistance');
                    
                    // Aplicar Resistance 255 (Invulnerabilidade)
                    if (!resistance || resistance.amplifier < 250 || resistance.duration < 220) {
                        try {
                            player.addEffect('resistance', 300, {
                                amplifier: 255, 
                                showParticles: false 
                            });
                            console.warn(`[CLANS] ✓ APPLIED Totem Invulnerability to ${player.name}`);
                        } catch (e) {}
                    }
                    break;
                }
            }
            
            if (!nearOwnTotem) {
                const resistance = player.getEffect('resistance');
                if (resistance && resistance.amplifier >= 250) {
                    player.removeEffect('resistance');
                    console.warn(`[CLANS] ✖ REMOVED Totem Invulnerability from ${player.name}`);
                }
            }
        }
    } catch (error) {
        console.warn('[CLANS] Erro ao aplicar efeitos:', error);
    }
}, 200); // Roda a cada 10 segundos (200 ticks)

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
        
        // Teleportar o jogador
        system.run(() => {
            player.teleport({ x: base.x + 2, y: base.y + 0.5, z: base.z + 2 }, { dimension: world.getDimension('overworld') });
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

        // ==========================================
        // COMANDOS DE ADMIN (CONSOLIDADOS AQUI)
        // ==========================================
        if (message === '!clean') {
            event.cancel = true;
            if (!checkAdmin(player)) return player.sendMessage('§cAcesso negado.');
            const ov = world.getDimension('overworld');
            player.sendMessage('§eLimpando NPCs...');
            try { ov.runCommand(`kill @e[type=npc,tag=totem_npc]`); } catch(e) {}
            try { ov.runCommand(`kill @e[type=npc,tag=clan_shop]`); } catch(e) {}
            try { ov.runCommand(`kill @e[type=npc,name="§6§lLOJA DO CLÃ"]`); } catch(e) {}
            system.runTimeout(maintenanceLoop, 40);
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
            if (!checkAdmin(player)) return;
            const args = message.match(/!setclan\s+("([^"]+)"|(\S+))\s+(\w+)/);
            if (!args) return player.sendMessage('§cUso: !setclan "Nick" <cor>');
            const targetName = args[2] || args[3];
            const clanKey = args[4].toLowerCase();
            if (!CLANS[clanKey]) return player.sendMessage('§cClã inválido.');
            const target = world.getAllPlayers().find(p => p.name === targetName);
            if (!target) return player.sendMessage('§cJogador não encontrado.');
            const newClan = CLANS[clanKey];
            for (const key in CLANS) if (target.hasTag(CLANS[key].tag)) target.removeTag(CLANS[key].tag);
            target.addTag(newClan.tag);
            target.nameTag = `${newClan.color}[${newClan.name}]\n${target.name}`;
            player.sendMessage(`§a${targetName} movido para ${newClan.name}.`);
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
// SISTEMA DE MANUTENÇÃO DE NPCs (TOTENS E LOJA)
//---------------------------------------------------------
// Loop de Manutenção: Garante existência e posição dos NPCs
// Loop de Manutenção: Garante existência e posição dos NPCs e segurança dos jogadores
function maintenanceLoop() {
    try {
        const overworld = world.getDimension('overworld');
        const allPlayers = world.getAllPlayers();
        if (allPlayers.length === 0) return;

        // --- 1. LIMPEZA DE TAGS POLLUÍDAS E EFEITOS DE DISTORÇÃO (PLAYERS) ---
        const badTags = ['totem_npc', 'clan_shop', 'totem_red', 'totem_blue', 'totem_green', 'totem_yellow'];
        for (const p of allPlayers) {
            // Remover tags de NPC se o player pegou por acidente
            for (const tag of badTags) if (p.hasTag(tag)) p.removeTag(tag);
            
            // ANTÍDOTO: Se o player tiver lentidão 255 (distorção) ou resistência 255 (bug de totem), remover
            const slowness = p.getEffect('slowness');
            if (slowness && slowness.amplifier >= 250) p.removeEffect('slowness');
            
            const resistance = p.getEffect('resistance');
            if (resistance && resistance.amplifier >= 250) p.removeEffect('resistance');

            // Resgate do Vazio (Void Rescue)
            if (p.location.y < -60) {
                p.teleport({ x: 0, y: 100, z: 0 });
                p.sendMessage('§e[SISTEMA] Voce foi resgatado do limbo!');
            }
        }

        // --- 2. MANUTENÇÃO DA LOJA DO CLÃ (SÓ NPC) ---
        const shops = overworld.getEntities({ typeId: 'minecraft:npc' }).filter(e => e.nameTag === '§6§lLOJA DO CLÃ' || e.hasTag('clan_shop'));
        
        if (shops.length === 0) {
            try {
                const newShop = overworld.spawnEntity('minecraft:npc', SHOP_LOCATION);
                newShop.nameTag = '§6§lLOJA DO CLÃ';
                newShop.addTag('clan_shop');
            } catch(e) {}
        }

        for (const shop of shops) {
            if (!shop.isValid) continue;
            if (!shop.hasTag('clan_shop')) shop.addTag('clan_shop');
            
            const loc = shop.location;
            const dist = Math.sqrt((loc.x-SHOP_LOCATION.x)**2 + (loc.z-SHOP_LOCATION.z)**2);
            if (dist > 1 || loc.y < -60) shop.teleport(SHOP_LOCATION);
            
            const npcComp = shop.getComponent('minecraft:npc');
            const DESIRED_SKIN = 19; 

            if (npcComp && npcComp.skinIndex !== DESIRED_SKIN) {
                try {
                    npcComp.skinIndex = DESIRED_SKIN;
                    world.sendMessage(`§a[SISTEMA] Skin da Loja atualizada para ${DESIRED_SKIN}!`);
                } catch (err) {
                    console.warn(`[CLANS] Erro ao aplicar skin ${DESIRED_SKIN}: ${err}`);
                }
            }
            if (!shop.getEffect('resistance')) shop.addEffect('resistance', 20000000, { amplifier: 255, showParticles: false });
            if (!shop.getEffect('slowness')) shop.addEffect('slowness', 20000000, { amplifier: 255, showParticles: false });
        }

        // --- 3. MANUTENÇÃO DOS TOTENS (SÓ NPC) ---
        for (const clanKey in CLANS) {
            try {
                const clan = CLANS[clanKey];
                const basePos = clan.base;
                const tag = `totem_${clanKey}`;
                let totem = overworld.getEntities({ typeId: 'minecraft:npc', tags: [tag] })[0];

                if (!totem) {
                    totem = overworld.getEntities({ typeId: 'minecraft:npc' }).find(e => e.nameTag.includes(`TOTEM ${clan.name}`));
                    if (totem) {
                        totem.addTag(tag);
                        totem.addTag('totem_npc');
                    } else {
                        try {
                            const t = overworld.spawnEntity('minecraft:npc', basePos);
                            t.nameTag = `§l${clan.color}TOTEM ${clan.name}`;
                            t.addTag(tag);
                            t.addTag('totem_npc');
                            totem = t;
                        } catch(e) {}
                    }
                }

                if (totem && totem.isValid && totem.typeId === 'minecraft:npc') {
                    const dist = Math.sqrt((totem.location.x-basePos.x)**2 + (totem.location.z-basePos.z)**2);
                    if (dist > 1 || totem.location.y < -60) totem.teleport(basePos);
                    
                    const npcComp = totem.getComponent('minecraft:npc');
                    if (npcComp) {
                        const idx = clanKey === 'red' ? 21 : clanKey === 'blue' ? 36 : clanKey === 'green' ? 26 : 39;
                        if (npcComp.skinIndex !== idx) npcComp.skinIndex = idx;
                    }
                    if (!totem.getEffect('resistance')) totem.addEffect('resistance', 20000000, { amplifier: 255, showParticles: false });
                    if (!totem.getEffect('slowness')) totem.addEffect('slowness', 20000000, { amplifier: 255, showParticles: false });
                }
            } catch (innerE) {}
        }

    } catch (e) {}
}

// Loop de Segurança (Alta Frequência: 0.5s)
system.runInterval(() => {
    try {
        for (const p of world.getAllPlayers()) {
            // Remover tags de NPC se o player pegou por acidente
            const badTags = ['totem_npc', 'clan_shop', 'totem_red', 'totem_blue', 'totem_green', 'totem_yellow'];
            for (const tag of badTags) if (p.hasTag(tag)) p.removeTag(tag);
            
            // Remover efeitos de NPC (Extremos) do jogador
            const slowness = p.getEffect('slowness');
            if (slowness && slowness.amplifier >= 250) p.removeEffect('slowness');
            
            const resistance = p.getEffect('resistance');
            if (resistance && resistance.amplifier >= 250) p.removeEffect('resistance');
        }
    } catch(e) {}
}, 10);

system.runInterval(maintenanceLoop, 100); // Manutenção de NPCs a cada 5s
system.runTimeout(maintenanceLoop, 20);

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
