import { world, system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { SHOP_CATEGORIES } from './config.js';
import { executeArenaMaintenanceStep, SNIPER_LOCATIONS } from './arena.js';


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
        name: 'Nação do Fogo', 
        color: '§c', 
        tag: 'clan_red',
        ...loadClanBase('red', { x: 42, y: 43, z: -225 }, 'nether')
    },
    blue: { 
        name: 'Nação da Água', 
        color: '§9', 
        tag: 'clan_blue',
        ...loadClanBase('blue', { x: -678, y: 24, z: 631 }, 'overworld')
    },
    green: { 
        name: 'Nação da Terra', 
        color: '§a', 
        tag: 'clan_green',
        ...loadClanBase('green', { x: -927, y: -17, z: -976 }, 'overworld')
    },
    yellow: { 
        name: 'Nação do Vento', 
        color: '§e', 
        tag: 'clan_yellow',
        ...loadClanBase('yellow', { x: -483, y: 170, z: 509 }, 'overworld')
    },
    staff: {
        name: 'Staff',
        color: '§0',
        tag: 'clan_staff',
        base: { x: 0, y: 0, z: 0 }, 
        dimension: 'overworld'
    },
    default: {
        name: 'Nomades',
        color: '§7',
        tag: 'clan_default',
        base: { x: 0, y: 0, z: 0 }, 
        dimension: 'overworld'
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
        aura: 'minecraft:white_smoke_particle'
    },
];

//------------------------------------------
// CONFIGURAÇÃO DA LOJA (Sistema Independente)
//------------------------------------------
const SHOP_CONFIG = {
    id: 'shop',
    location: { x: -43, y: 67, z: 54 },
    dimension: 'overworld',
    tag: 'clan_shop',
    name: '§6§lLOJA DO CLÃ',
    typeId: 'minecraft:npc'
};

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
            return cleanTag.includes('admin') || cleanTag.includes('op');
        });
    } catch(e) { return false; }
}

// Helper centralizado para obter scores de forma segura (evita erros de identidade)
function getPlayerScore(player, objectiveId) {
    try {
        const obj = world.scoreboard.getObjective(objectiveId);
        if (!obj) return 0;
        
        // Em Bedrock, jogadores online devem ser acessados pelo OBJETO para evitar fragmentação
        const entityScore = obj.getScore(player);
        
        // No entanto, se houver um "fantasma" com o nome dele, queremos o valor mais alto
        let maxScore = entityScore ?? 0;
        let foundAny = entityScore !== undefined;

        for (const p of obj.getParticipants()) {
            if (p.displayName === player.name && !p.getEntity()) { // Apenas fragmentos de string
                const s = obj.getScore(p);
                if (s !== undefined) {
                    maxScore = Math.max(maxScore, s);
                    foundAny = true;
                }
            }
        }
        
        return maxScore;
    } catch (e) {
        return 0;
    }
}

// Helper centralizado para adicionar scores de forma segura (O mais Robusto possível)
function addPlayerScore(player, objectiveId, amount) {
    try {
        const obj = world.scoreboard.getObjective(objectiveId);
        if (!obj) return false;

        // 🛠️ MIGRATION EXPRESS: Detectar e absorver fragmentos ANTES de adicionar
        let fragmentedScore = 0;
        for (const p of obj.getParticipants()) {
            if (p.displayName === player.name && !p.getEntity()) {
                fragmentedScore += (obj.getScore(p) || 0);
                try { obj.removeParticipant(p); } catch(e) {}
            }
        }

        // Adicionar o novo valor + o que foi recuperado dos fantasmas diretamente na entidade
        const currentEntityScore = obj.getScore(player) || 0;
        obj.setScore(player, currentEntityScore + fragmentedScore + amount);
        
        return true;
    } catch (e) {
        // Fallback final por comando se o objeto Entity estiver bugado
        try {
            const sign = amount >= 0 ? 'add' : 'remove';
            const val = Math.abs(amount);
            player.runCommand(`scoreboard players ${sign} @s ${objectiveId} ${val}`);
            return true;
        } catch (e2) { return false; }
    }
}

// Obter cargo do jogador baseado em abates ou tag de rei
function getRank(player, clan) {
    // 1. Caso seja STAFF (Administração)
    if (player.hasTag(CLANS.staff.tag)) {
        if (player.hasTag('staff_adm')) return 'Administrador';
        if (player.hasTag('staff_mod')) return 'Moderador';
        return 'Staff';
    }

    // 2. Caso seja NÔMADE (Sem clã)
    if (player.hasTag(CLANS.default.tag)) return 'Nomades';

    // 3. Caso seja de uma das 4 NAÇÕES (Combate)
    if (player.hasTag('clan_king')) return 'Rei';
    const kills = getPlayerScore(player, 'player_kills');
    if (kills >= 50) return 'Soldado';
    if (kills >= 20) return 'Recruta';
    
    // Cargo inicial padrão das nações
    return 'Membro';
}




//------------------------------------------
// ECONOMIA (SISTEMA DE DINHEIRO)
//------------------------------------------
system.runInterval(() => {
    try {
        // Forçar criação e exibição (Essencial para mundos novos)
        let objective = world.scoreboard.getObjective('coins');
        if (!objective) objective = world.scoreboard.addObjective('coins', '§6Coins');
        
        // Inicializar placar de abates se não existir
        let killObjective = world.scoreboard.getObjective('player_kills');
        if (!killObjective) world.scoreboard.addObjective('player_kills', '§cAbates');
        
        world.scoreboard.setObjectiveAtDisplaySlot('sidebar', { objective: objective });

        // Inicializar jogadores online (Muito importante para evitar o erro de identidade no primeiro acesso)
        for (const player of world.getAllPlayers()) {
            const playerName = player.name;
            try {
                // 🛠️ AGENDA DE NOMES: Registrar o ID único do jogador para resolver nomes offline depois
                const identity = player.scoreboardIdentity;
                if (identity) {
                    world.setDynamicProperty(`name_id_${identity.id}`, playerName);
                }

                // 🛠️ MIGRATION/CLEANUP: Unificar identidades fragmentadas
                // Se houver score no "Nome (String)" e no "Objeto (Entity)", somar tudo no Objeto
                const killObj = world.scoreboard.getObjective('player_kills');
                if (killObj) {
                    const allParticipants = killObj.getParticipants();
                    let stringScore = 0;
                    let hasStringFragment = false;

                    for (const p of allParticipants) {
                        // Se o participante for apenas uma String (sem entidade vinculada) e tiver o nome do player
                        if (p.displayName === player.name) {
                            try {
                                // Verificar se não é o próprio objeto (Bedrock as vezes mostra o nome para a entidade também)
                                if (!p.getEntity()) {
                                    stringScore = killObj.getScore(p) || 0;
                                    if (stringScore > 0) {
                                        hasStringFragment = true;
                                        killObj.removeParticipant(p); // Limpar fragmento
                                    }
                                }
                            } catch(e) {}
                        }
                    }

                    if (hasStringFragment) {
                        addPlayerScore(player, 'player_kills', stringScore);
                        console.warn(`[CLANS] Migrando ${stringScore} abates fragmentados para ${player.name}`);
                    }
                }

                const currentCoins = getPlayerScore(player, 'coins') ?? 0;
                
                // BACKUP: Se o valor no placar for MAIOR que o backup, atualiza o backup
                const savedCoins = world.getDynamicProperty(`score_coins_${playerName}`) ?? 0;

                if (currentCoins > savedCoins) world.setDynamicProperty(`score_coins_${playerName}`, currentCoins);
                
                // RESTAURAÇÃO: Apenas Moedas (Isolando a economia do combate)
                if (currentCoins < savedCoins) {
                    const diff = savedCoins - currentCoins;
                    addPlayerScore(player, 'coins', diff);
                }
            } catch (e) {}
        }
    } catch (e) {}
}, 20);

// CONTADOR DE ABATES (NOVO)
world.afterEvents.entityDie.subscribe((event) => {
    const victim = event.deadEntity;
    const damager = event.damageSource.damagingEntity;
    
    // Verificar se foi um player matando outro player
    if (victim.typeId === 'minecraft:player' && damager?.typeId === 'minecraft:player') {
        try {
            const currentKills = getPlayerScore(damager, 'player_kills') ?? 0;
            if (addPlayerScore(damager, 'player_kills', 1)) {
                // Feedback imediato no chat (Calculado localmente para ser instantâneo)
                damager.sendMessage(`§a[COMBATE] Voce abateu ${victim.name}! Total de abates: ${currentKills + 1}`);
                
                // Forçar atualização de nome logo em seguida
                system.runTimeout(() => {
                    updatePlayerNames();
                }, 20);
            }
        } catch (e) {
            console.warn('[CLANS] Erro ao registrar abate:', e);
        }
    }
});

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
            'fireTick',
            'minecraft:lava',
            'minecraft:magma_cube' // Just in case
        ];
        
        if (event.damageSource.cause && FIRE_SOURCES.includes(event.damageSource.cause)) {
            event.cancel = true;
            return;
        }
    }

    //------------------------------------------
    // HABILIDADE CLÃ RED: Flame Blade (Chance de queimar ao atacar)
    //------------------------------------------
    if (damager?.typeId === 'minecraft:player' && damager.hasTag(CLANS.red.tag)) {
        // 15% de chance de incendiar por 3 segundos
        if (Math.random() < 0.15 && victim.isValid()) {
            victim.setOnFire(3);
            damager.onScreenDisplay.setActionBar('§c🔥 LÂMINA DE LABAREDA! §7Inimigo incendiado.');
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
    

    
    // Verificar situação do clã
    let currentClanKey = null;
    for (const key in CLANS) {
        if (player.hasTag(CLANS[key].tag)) {
            currentClanKey = key;
            break;
        }
    }
    
    if (!currentClanKey) {
        // É a primeira vez do jogador: mostrar seleção única
        player.sendMessage(`§7[SISTEMA] Bem-vindo! Escolha seu clã inicial.`);
        
        // Atribuir Nômade temporário até escolher
        player.addTag(CLANS.default.tag);
        player.nameTag = `${CLANS.default.color}[ ${CLANS.default.name} ]\n§f${player.name}`;
        
        system.runTimeout(() => {
            if (player.isValid) showClanSelectionMenu(player);
        }, 100); 
    } else {
        // Já tem um clã real: Apenas Boas-Vindas
        const clan = CLANS[currentClanKey];
        const rank = getRank(player, clan);
        player.nameTag = `${clan.color}[ ${rank} ]\n§f${player.name}`;
        player.sendMessage(`§7[SISTEMA] Voce e um §f${rank} da ${clan.name}§7. Bem-vindo de volta!`);
        world.sendMessage(`${clan.color}${player.name} §7(da ${clan.name}) entrou no servidor.`);
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
    
    form.button(`${CLANS.red.color}[${CLANS.red.name}]\n§7Poder do Fogo`);
    form.button(`${CLANS.blue.color}[${CLANS.blue.name}]\n§7Poder da Água`);
    form.button(`${CLANS.green.color}[${CLANS.green.name}]\n§7Poder da Terra`);
    form.button(`${CLANS.yellow.color}[${CLANS.yellow.name}]\n§7Poder do Vento`);
    
    const response = await form.show(player);
    if (!player) return;
    
    // CASO CANCELE: Vira Nômade permanentemente (é a 6ª opção automática)
    if (response.canceled) {
        player.addTag(CLANS.default.tag);
        player.nameTag = `${CLANS.default.color}[ ${CLANS.default.name} ]\n§f${player.name}`;
        player.sendMessage(`§e[SISTEMA] Você escolheu seguir como §f${CLANS.default.name}§e.`);
        player.sendMessage(`§7(Agora, trocas de clã só podem ser feitas por Staff/Admin)`);
        return;
    }
    
    const clanKeys = ['red', 'blue', 'green', 'yellow'];
    const selectedClan = CLANS[clanKeys[response.selection]];
    
    // Remover tag de Nômade se existir
    if (player.hasTag(CLANS.default.tag)) player.removeTag(CLANS.default.tag);
    
    player.addTag(selectedClan.tag);
    const rank = getRank(player);
    player.nameTag = `${selectedClan.color}[ ${rank} ]\n§f${player.name}`;
    
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

// Função para atualizar os nomes dos jogadores com seus clãs e cargos
function updatePlayerNames() {
    try {
        for (const player of world.getAllPlayers()) {
            for (const clanKey in CLANS) {
                const clan = CLANS[clanKey];
                if (player.hasTag(clan.tag)) {
                    const rank = getRank(player, clan);
                    
                    // Formato Único: [ Cargo/Clã ] em cima, nick branco em baixo
                    const displayName = `${clan.color}[ ${rank} ]\n§f${player.name}`;
                    
                    if (player.nameTag !== displayName) {
                        player.nameTag = displayName;
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
            // 🔴 CLÃ RED: Resistência ao Fogo + Nether Might
            if (player.hasTag(CLANS.red.tag)) {
                player.addEffect('fire_resistance', 600, { showParticles: false });
                
                // Nether Might: Força I no Nether
                if (player.dimension.id === 'minecraft:nether') {
                    player.addEffect('strength', 600, { amplifier: 0, showParticles: false });
                }
            }

            // 🔵 CLÃ BLUE: Respiração Aquática + Mist Walker (Sneak)
            if (player.hasTag(CLANS.blue.tag)) {
                // Respiração + Visão Submersa
                player.addEffect('water_breathing', 600, { showParticles: false });
                
                if (player.isInWater) {
                    player.addEffect('night_vision', 600, { showParticles: false });
                    player.addEffect('speed', 600, { amplifier: 0, showParticles: false });
                    player.addEffect('haste', 600, { amplifier: 0, showParticles: false });
                }

                // Mist Walker: Invisibilidade ao agachar (Sneak)
                if (player.isSneaking) {
                    player.addEffect('invisibility', 40, { showParticles: false }); // Apenas 2 segundos
                } else {
                    // Remover se não estiver agachado (para ser instantâneo)
                    player.removeEffect('invisibility');
                }
            }


            // 🟢 CLÃ GREEN: Visão Noturna + Pele de Ferro
            if (player.hasTag(CLANS.green.tag)) {
                player.addEffect('night_vision', 600, { showParticles: false });
                
                // Iron Skin: Resistência I Permanente
                player.addEffect('resistance', 600, { amplifier: 0, showParticles: false });
            }

            // 🟡 CLÃ YELLOW: Imunidade Queda + Architect Speed
            if (player.hasTag(CLANS.yellow.tag)) {
                // Architect Speed: Velocidade II + Pressa II
                player.addEffect('speed', 600, { amplifier: 1, showParticles: false });
                player.addEffect('haste', 600, { amplifier: 1, showParticles: false });
            }

            // ⚪ CLÃ STAFF: Imortalidade + Pacifismo (Fraqueza)

            if (player.hasTag(CLANS.staff.tag)) {
                const res = player.getEffect('resistance');
                if (!res || res.amplifier < 250) player.addEffect('resistance', 600, { amplifier: 255, showParticles: false });
                
                // Só colocar fraqueza se NÃO for "staff_adm" (Permissão de Luta)
                if (!player.hasTag('staff_adm')) {
                    const weak = player.getEffect('weakness');
                    if (!weak || weak.amplifier < 250) player.addEffect('weakness', 600, { amplifier: 255, showParticles: false });
                } else {
                    // Se era admin e tinha fraqueza, remover para permitir luta
                    if (player.getEffect('weakness')) player.removeEffect('weakness');
                }
            }



            // Nômades (Default) não têm poderes (sem totem)
            // --- DEFESA NOS TOTENS (TODOS OS CLÃS) ---
            let nearOwnTotem = false;
            let currentBaseKey = null;

            for (const clanKey in CLANS) {
                // Staff e Nômades não têm territórios físicos ou totens
                if (clanKey === 'staff' || clanKey === 'default') continue;

                const clan = CLANS[clanKey];
                const inThisBase = isInBase(player, clan.base, clan.dimension || 'overworld');
                
                if (inThisBase) currentBaseKey = clanKey;

                if (player.hasTag(clan.tag) && inThisBase) {
                    nearOwnTotem = true;
                    // Proteção de Base (Invulnerabilidade)
                    player.addEffect('resistance', 300, { amplifier: 255, showParticles: false });

                    // --- BÊNÇÃOS DO TOTEM (Proximidade) ---
                    switch (clanKey) {
                        case 'red':
                            player.addEffect('strength', 300, { amplifier: 1, showParticles: true }); // Str II
                            break;
                        case 'blue':
                            player.addEffect('conduit_power', 300, { amplifier: 0, showParticles: true });
                            player.addEffect('night_vision', 300, { amplifier: 0, showParticles: true });
                            break;
                        case 'green':
                            player.addEffect('regeneration', 300, { amplifier: 1, showParticles: true }); // Regen II
                            player.addEffect('absorption', 300, { amplifier: 1, showParticles: true }); // Abs II
                            break;
                        case 'yellow':
                            player.addEffect('speed', 300, { amplifier: 2, showParticles: true }); // Speed III
                            player.addEffect('jump_boost', 300, { amplifier: 1, showParticles: true }); // Jump II
                            break;
                    }
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
                    player.onScreenDisplay.setActionBar(`§eEntrando no territorio da ${clan.color}${clan.name}`);
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
    const victim = event.hurtEntity;
    const damager = event.damageSource.damagingEntity;

    // 🛡️ STAFF: Não sofre dano de NINGUÉM nem de NADA
    if (victim.typeId === 'minecraft:player' && victim.hasTag(CLANS.staff.tag)) {
        event.cancel = true;
        return;
    }

    // 🛡️ STAFF: Não causa dano a NINGUÉM nem a NADA (Exceto se for staff_adm)
    if (damager && damager.typeId === 'minecraft:player' && damager.hasTag(CLANS.staff.tag)) {
        if (!damager.hasTag('staff_adm')) {
            event.cancel = true;
            return;
        }
    }



    if (victim.typeId !== 'minecraft:player') return;
    const player = victim;

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

        // --- ARENA DEBUG (TOP PRIORITY) ---
        const ARENA_CMDS = ['!arenastatus', '!tparena', '!gerararena120', '!resetarena', '!limpararenaantiga', '!arenapasso'];
        if (ARENA_CMDS.some(cmd => msgLow.startsWith(cmd))) {

            event.cancel = true;
            console.warn(`[ARENA-DEBUG] Comando detectado: ${msgLow}`);
            
            system.run(() => {
                try {
                    if (!checkAdmin(player)) {
                        player.sendMessage('§cVoce nao tem permissao Admin!');
                        return;
                    }

                    if (msgLow === '!arenastatus') {
                        const prop = world.getDynamicProperty('arena_120_generated');
                        const step = world.getDynamicProperty('arena_120_step') ?? 0;
                        player.sendMessage(`§e[ARENA 60] Status: §f${prop ? 'CONCLUIDA' : 'EM CONSTRUCAO'}`);
                        player.sendMessage(`§e[ARENA 60] Passo Atual: §f${step}/15`);
                        player.sendMessage(`§7Coordenadas: §f-200..-141 / 64..123`);
                    } else if (msgLow === '!tparena') {
                        player.teleport({ x: -170, y: 68, z: 94 }, { dimension: world.getDimension('overworld') });
                        player.sendMessage('§aTeleportado para o centro da Arena 60x60!');
                    } else if (msgLow === '!gerararena120') {
                        world.setDynamicProperty('arena_120_generated', false);
                        world.setDynamicProperty('arena_120_step', 0);
                        player.sendMessage('§eIniciando geracao automatica via loop...');
                    } else if (msgLow === '!resetarena' || msgLow === '!redoarena') {
                        world.setDynamicProperty('arena_120_generated', false);
                        world.setDynamicProperty('arena_120_step', 0);
                        player.sendMessage('§e[ARENA] Sistema de geracao REINICIADO!');
                        player.sendMessage('§7Limpando terreno e reconstruindo em 5 segundos...');
                        player.sendMessage('§c§lAVISO: §7Permaneça na area para carregar os chunks!');
                    } else if (msgLow.startsWith('!arenapasso ')) {
                        const stepStr = msgLow.split(' ')[1];
                        const step = parseInt(stepStr);
                        if (!isNaN(step)) {
                            world.setDynamicProperty('arena_120_generated', false);
                            world.setDynamicProperty('arena_120_step', step);
                            player.sendMessage(`§e[ARENA] Invocando §lPASSO ${step}§r§e agora...`);
                            
                            // Executar IMEDIATAMENTE para dar feedback
                            try {
                                executeArenaMaintenanceStep(step);
                            } catch (e) {
                                player.sendMessage(`§cErro ao executar: ${e}`);
                            }
                        } else {

                            player.sendMessage('§cUse: !arenapasso <numero>');
                        }
                    } else if (msgLow === '!limpararenaantiga') {


                        player.sendMessage('§eIniciando limpeza profunda do local antigo (-80, 64, 9)...');
                        const dim = world.getDimension('overworld');
                        // Limpar uma área maior por segurança
                        for(let i = -5; i < 20; i++) {
                            dim.runCommandAsync(`fill -145 ${64+i} -55 -15 ${64+i} 75 air`).catch(() => {});
                        }
                        player.sendMessage('§aComando de limpeza enviado! (Verifique o local antigo)');
                    }
                } catch (e) {
                    player.sendMessage(`§cErro: ${e}`);
                }
            });
            return;
        }
        
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
    
        // COMANDO: SALDO / BALANÇO
        if (msgLow === '!saldo' || msgLow === '!money' || msgLow === '!balance') {
            event.cancel = true;
            const score = getPlayerScore(player, 'coins');
            
            player.sendMessage(`§e--------------------------------`);
            player.sendMessage(`§fNome: §b${player.name}`);
            player.sendMessage(`§6Saldo: §a${score} Coins`);
            player.sendMessage(`§e--------------------------------`);
            return;
        }

        // COMANDO: TOP ABATES (RANKING)
        if (msgLow === '!top' || msgLow === '!ranking' || msgLow === '!abates') {
            event.cancel = true;
            try {
                const killObj = world.scoreboard.getObjective('player_kills');
                if (!killObj) {
                    player.sendMessage('§cErro: Placar de abates não encontrado.');
                    return;
                }

                // 🛠️ DEDUPLICAÇÃO E LIMPEZA: Unificar scores com o mesmo nome e filtrar lixo
                const rawScores = killObj.getParticipants().map(p => {
                    let name = p.displayName;
                    
                    // Se o nome for técnico ou "offline", tentar traduzir pela nossa Agenda de IDs
                    if (name.includes('offlineplayername') || name.startsWith('commands.') || name.includes('-')) {
                        const savedName = world.getDynamicProperty(`name_id_${p.id}`);
                        if (savedName) name = savedName;
                    }
                    
                    return { name, score: killObj.getScore(p) };
                });

                // Regex para detectar UUIDs ou Tags técnicas poluem o ranking
                const technicalRegex = /^[0-9a-f]{8}-|[0-9a-f]{4}-|[*#§]/i;

                const unifiedMap = new Map();
                for (const entry of rawScores) {
                    const name = entry.name;
                    
                    // FILTROS DE LIMPEZA (Se mesmo após traduzir o nome for lixo, ignorar)
                    if (technicalRegex.test(name) && name.length > 20) continue; 
                    if (name.startsWith('*') || name.startsWith('#')) continue;
                    
                    const currentMax = unifiedMap.get(name) || 0;
                    if (entry.score > currentMax) unifiedMap.set(name, entry.score);
                }

                const scores = Array.from(unifiedMap.entries())
                    .map(([name, score]) => ({ name, score }))
                    .sort((a, b) => b.score - a.score);

                const playerKills = getPlayerScore(player, 'player_kills') ?? 0;

                player.sendMessage('§e=== RANKING DE ABATES ===');
                
                // Mostrar Top 3
                const colors = ['§6§l🥇', '§7§l🥈', '§6§l🥉']; 
                for (let i = 0; i < 3; i++) {
                    if (scores[i]) {
                        player.sendMessage(`${colors[i]} §f${i + 1}. ${scores[i].name} §7- §e${scores[i].score} abates`);
                    } else {
                        player.sendMessage(`${colors[i]} §f${i + 1}. §8---`);
                    }
                }

                player.sendMessage('§e------------------------');
                player.sendMessage(`§fSeu Rank: §a${playerKills} abates`);
                player.sendMessage('§e========================');
            } catch (e) {
                player.sendMessage('§cErro ao gerar ranking.');
            }
            return;
        }

        // COMANDO: PAGAR / DAR MOEDAS (Player x Player)
        // Uso: !pagar "Nome" valor
        if (msgLow.startsWith('!darmoedas') || msgLow.startsWith('!pagar') || msgLow.startsWith('!pay')) {
            event.cancel = true;
            
            const args = message.match(/"([^"]+)"|'([^']+)'|(\S+)/g);
            if (!args || args.length < 3) {
                player.sendMessage('§cUso incorreto! Digite: !pagar "Nome do Jogador" valor');
                return;
            }

            let targetName = args[1].replace(/"/g, '').replace(/'/g, ''); 
            const amount = parseInt(args[2]);

            if (isNaN(amount) || amount <= 0) {
                player.sendMessage('§cValor invalido!');
                return;
            }

            // Verificar saldo do pagador
            const balance = getPlayerScore(player, 'coins');
            
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
            if (addPlayerScore(player, 'coins', -amount)) {
                addPlayerScore(targetPlayer, 'coins', amount);
                
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

            if (addPlayerScore(targetPlayer, 'coins', amount)) {
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
        
        if (!playerClan || playerClan.tag === CLANS.default.tag || playerClan.tag === CLANS.staff.tag) {
            player.sendMessage('§cNômades e Staff não possuem uma base fixa para teleporte!');
            return;
        }

        // Verificar custo (100 coins)
        const balance = getPlayerScore(player, 'coins');
        const cost = 100;
        
        if (balance < cost) {
            player.sendMessage(`§cVoce precisa de ${cost} Coins para teleportar! Seu saldo: ${balance} Coins`);
            return;
        }
        
        // 🛡️ TRAVA DE SEGURANÇA: Só teleporta se o pagamento passar
        console.warn(`[DEBUG-BASE] Player: ${player.name}, Saldo pego: ${balance}, Tentando cobrar: ${cost}`);
        
        system.run(() => {
            if (addPlayerScore(player, 'coins', -cost)) {
                player.sendMessage(`§eDescontado ${cost} Coins do seu saldo.`);
                
                const base = playerClan.base;
                const dimensionName = playerClan.dimension || 'overworld';
                
                try {
                    player.teleport({ x: base.x + 2, y: base.y + 0.5, z: base.z + 2 }, { dimension: world.getDimension(dimensionName) });
                    player.sendMessage(`${playerClan.color}[CLAN] §aVoce foi teleportado para a base ${playerClan.name}!`);
                } catch (e) {
                    // Se falhar o TP (ex: chunk descarregado), devolve o dinheiro
                    addPlayerScore(player, 'coins', cost);
                    player.sendMessage('§cErro ao teleportar. Custo devolvido.');
                }
            } else {
                const currentObj = world.scoreboard.getObjective('coins');
                console.warn(`[DEBUG-BASE-ERRO] Falha ao adicionar score. Objetivo existe: ${!!currentObj}`);
                player.sendMessage('§cErro ao processar pagamento. Verifique se o placar "coins" existe.');
            }
        });
    }


    // --- COMANDOS DE ADMIN (TELEPORTE E DEBUG) ---
    if (msgLow.startsWith('!tpbase ') || (msgLow.startsWith('!base ') && msgLow.split(' ').length > 1)) {
        event.cancel = true;
        // Staff e Admin podem usar
        const isStaff = player.hasTag(CLANS.staff.tag);
        if (!checkAdmin(player) && !isStaff) return;
        
        const clanKey = msgLow.split(' ')[1];
        const clan = CLANS[clanKey];
        if (!clan) {
            player.sendMessage('§cClã inválido!');
            return;
        }
        system.run(() => {
            player.teleport(clan.base, { dimension: world.getDimension(clan.dimension || 'overworld') });
            player.sendMessage(`§a[ADMIN] Teleportado para a base do clã ${clanKey}`);
        });
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

            system.run(() => {
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
            });
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
                    system.run(() => {
                        player.teleport(originalPos, { dimension: originalDim });
                        player.sendMessage(`§a[CLEANALL] Concluído! ${totalRemoved} NPCs removidos`);
                    });
                    return;
                }
                
                const loc = locations[currentIndex];
                const dim = world.getDimension(loc.dim);
                
                player.sendMessage(`§7[${currentIndex + 1}/${locations.length}] Limpando ${loc.name}...`);
                
                // Teleportar para o local
                system.run(() => {
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
                });
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

        if (message.startsWith('!setrei ')) {
            event.cancel = true;
            if (!checkAdmin(player)) return;
            
            const targetName = message.substring(8).replace(/"/g, '').trim();
            const target = world.getAllPlayers().find(p => p.name === targetName);
            
            if (!target) {
                player.sendMessage(`§c[ERRO] Jogador "${targetName}" nao encontrado!`);
                return;
            }
            
            // Descobrir clã do alvo
            let targetClan = null;
            for (const key in CLANS) {
                if (target.hasTag(CLANS[key].tag)) {
                    targetClan = CLANS[key];
                    break;
                }
            }
            
            if (!targetClan || targetClan.tag === 'clan_staff' || targetClan.tag === 'clan_default') {
                player.sendMessage(`§c[ERRO] O Rei deve pertencer a uma das 4 Nacoes!`);
                return;
            }
            
            // Remover tag de rei de QUALQUER UM na mesma nação
            for (const p of world.getAllPlayers()) {
                if (p.hasTag(targetClan.tag) && p.hasTag('clan_king')) {
                    p.removeTag('clan_king');
                    p.sendMessage(`§c[AVISO] Voce nao e mais o Rei da ${targetClan.name}.`);
                }
            }
            
            // Dar a tag para o novo rei
            target.addTag('clan_king');
            player.sendMessage(`§a[SUCESSO] ${target.name} agora e o Rei da ${targetClan.name}!`);
            target.sendMessage(`§6§l[COROACAO] §eVoce foi coroado Rei da ${targetClan.color}${targetClan.name}§e!`);
            
            system.runTimeout(() => updatePlayerNames(), 20);
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
                const rank = getRank(p);
                p.nameTag = `${newClan.color}${rank} da ${newClan.name}\n${newClan.color}${p.name}`;
            }
            player.sendMessage(`§aTodos movidos para a ${newClan.name}!`);
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
            const rank = getRank(target);
            target.nameTag = `${newClan.color}${rank} da ${newClan.name}\n${newClan.color}${target.name}`;
            
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
                    const rank = getRank(target);
                    target.nameTag = `${newClan.color}${rank} da ${newClan.name}\n${newClan.color}${target.name}`;
                    
                    player.sendMessage(`§a[OK] ${targetName} -> ${newClan.color}${newClan.name}`);
                    target.sendMessage(`§aVoce agora faz parte da ${newClan.color}${newClan.name}§a!`);
                    
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
    return getPlayerScore(player, 'coins');
}

// 4. Lógica de Compra
function buyItem(player, item, category) {
    const balance = getPlayerScore(player, 'coins');
    
    console.warn(`[DEBUG] Tentativa de compra: Player=${player.name}, Saldo=${balance}, Preco=${item.price}`);

    if (balance < item.price) {
        player.sendMessage(`§cVoce nao tem coins suficientes! Precisa de ${item.price}.`);
        system.run(() => openClanShopCategory(player, category));
        return;
    }
    
    if (addPlayerScore(player, 'coins', -item.price)) {
        const commands = item.command.split('\n');
        for (const cmd of commands) {
            if (cmd.trim().length > 0) player.runCommand(cmd.trim());
        }
        player.sendMessage(`§aVoce comprou §f${item.name} §apor §e${item.price} Coins§a!`);
    } else {
        player.sendMessage('§cErro na transacao. Compra cancelada.');
    }
    
    system.run(() => openClanShopCategory(player, category));
}

// 5. Listener de Interação (LOJA E OBJETOS)
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const target = event.target;
    const player = event.player;
    
    // A. SISTEMA DE LOJA (Prioridade Máxima)
    if (target.hasTag('clan_shop') || target.typeId === 'minecraft:npc') {
        event.cancel = true; // Impedir menu padrão de NPC
        
        system.run(() => {
            showShopWelcomeMenu(player);
        });
        return;
    }

    // B. PROTEÇÃO DE TOTENS (Anti-Roubo)
    if (target.hasTag('totem_npc')) {
        event.cancel = true;
        return;
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
                    }
                );
            } catch (e) {
                console.warn(`[CLANS] Erro crítico manutenção ${config.id}: ${e}`);
            }
        }

        // --- 3. MANUTENÇÃO DA LOJA (INDETERMINADA) ---
        try {
            const shopDim = world.getDimension(SHOP_CONFIG.dimension);
            ensureEntityAtExactPosition(
                shopDim,
                SHOP_CONFIG.typeId,
                [SHOP_CONFIG.tag],
                SHOP_CONFIG.name,
                SHOP_CONFIG.location,
                (entity) => {
                    // Setup exclusivo da loja
                    if (!entity.hasTag('clan_shop')) entity.addTag('clan_shop');
                    // Garantir que a loja não tenha os efeitos de totem (se desejado ela ser móvel ou não)
                    if (!entity.getEffect('resistance')) entity.addEffect('resistance', 20000000, { amplifier: 255, showParticles: false });
                }
            );
        } catch(e) {
            console.warn(`[CLANS] Erro crítico manutenção da loja: ${e}`);
        }

        console.warn(`[CLANS] Manutencao de rotina concluida - ${allPlayers.length} jogadores online.`);
    } catch (e) {
        console.warn(`[CLANS] Erro no loop de manutencao: ${e}`);
    }
}

// Loop de Segurança e Manutenção (1 minuto)
system.runInterval(maintenanceLoop, 1200);

// Loop de Construção da Arena (Mais rápido - a cada 10 segundos até terminar)
system.runInterval(() => {
    try {
        const isArenaGenerated = world.getDynamicProperty('arena_120_generated');
        if (!isArenaGenerated) {
            let currentStep = world.getDynamicProperty('arena_120_step') ?? 0;
            if (currentStep <= 11) {

                console.warn(`[ARENA-LOOP] Executando passo ${currentStep}`);
                executeArenaMaintenanceStep(currentStep);
                world.setDynamicProperty('arena_120_step', currentStep + 1);
            }
        }
    } catch (e) {
        console.warn(`[ARENA-LOOP-ERRO] ${e}`);
    }
}, 200);

// --- AUXILIAR: VERIFICAR SE ESTÁ NA ARENA (60x60 CORE) ---
function isInsideArena(pos) {
    // Apenas a área central (dentro do muro, excluindo a calçada)
    // xMid = -170, zMid = 93 -> 60x60 é ±30
    return (pos.x >= -200 && pos.x <= -140 && pos.z >= 63 && pos.z <= 123);
}





// --- NOVO: SEGURANÇA DA ARENA (Impedir Drops e Restaurar Inventário) ---
const arenaInventoryStore = new Map();


// 1. MONITOR DE ENTRADA (Salva assim que entra na arena)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const inArena = isInsideArena(player.location);
        const hasTag = player.hasTag('arena_participant');

        // ENTROU NA ARENA: Gravar Inventário Imediatamente
        if (inArena && !hasTag) {
            try {
                const inv = player.getComponent('inventory').container;
                const savedItems = [];
                for (let i = 0; i < inv.size; i++) {
                    const item = inv.getItem(i);
                    if (item) {
                        // FILTRO: Apenas equipamentos, armas e ferramentas (itens com durabilidade ou tags específicas)
                        const hasDurability = item.getComponent('durability') !== undefined;
                        const isSword = item.typeId.includes('sword');
                        const isBow = item.typeId.includes('bow') || item.typeId.includes('crossbow');
                        const isTool = item.typeId.includes('pickaxe') || item.typeId.includes('axe') || item.typeId.includes('shovel') || item.typeId.includes('hoe');
                        
                        if (hasDurability || isSword || isBow || isTool) {
                            savedItems.push({ slot: i, item: item.clone() });
                        }
                    }
                }
                
                const equippable = player.getComponent('equippable');
                const equipment = {};
                for (const slot of ['Head', 'Chest', 'Legs', 'Feet', 'Offhand']) {
                    const item = equippable.getEquipment(slot);
                    if (item) equipment[slot] = item.clone();
                }

                arenaInventoryStore.set(player.id, { items: savedItems, equipment, timestamp: Date.now() });
                player.addTag('arena_participant');
                player.sendMessage('§7[ARENA] Inventário protegido!');
            } catch (e) {}
        }

        // SAIU DA ARENA: Limpar Snapshot para evitar abusos fora da arena
        if (!inArena && hasTag) {
            player.removeTag('arena_participant');
            arenaInventoryStore.delete(player.id);
            player.sendMessage('§7[ARENA] Proteção desativada (você saiu da arena).');
        }
    }
}, 20); // Verifica a cada 1 segundo


// 2. Limpeza de Drops e Gatilho de Restauração
world.afterEvents.entityDie.subscribe((event) => {
    try {
        const dead = event.deadEntity;
        if (!dead) return;
        
        const pos = dead.location;
        const dim = dead.dimension;

        if (isInsideArena(pos)) {
            // LIMPEZA AGRESSIVA Anti-Roubo: Rodar por 5 ticks seguidos
            for (let i = 0; i < 5; i++) {
                system.runTimeout(() => {
                    try {
                        const items = dim.getEntities({ location: pos, maxDistance: 12, typeId: 'minecraft:item' });
                        for (const item of items) item.remove();
                    } catch (e) {}
                }, i);
            }
        }
    } catch (e) {
        // Silenciar erro se a entidade ficar inválida no meio do processo
    }
});


// 3. Restaurar ao Renascer
world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    if (arenaInventoryStore.has(player.id)) {
        const saved = arenaInventoryStore.get(player.id);
        
        system.runTimeout(() => {
            try {
                const inv = player.getComponent('inventory').container;
                inv.clearAll();
                // Restaurar apenas os itens gravados na entrada
                for (const entry of saved.items) inv.setItem(entry.slot, entry.item);
                
                const equippable = player.getComponent('equippable');
                for (const slot in saved.equipment) {
                    if (saved.equipment[slot]) equippable.setEquipment(slot, saved.equipment[slot]);
                }
                
                arenaInventoryStore.delete(player.id);
                player.removeTag('arena_participant'); // Limpar tag para novo snapshot na reentrada
                player.sendMessage('§a§lARENA: §fSeus equipamentos foram devolvidos!');
                player.playSound('random.orb');
            } catch (e) {}
        }, 10);
    }
});





// --- NOVO: SISTEMA DE SNIPER AUTOMATICO (Substitui o ovo de esqueleto) ---
system.runInterval(() => {
    try {
        const isArenaGenerated = world.getDynamicProperty('arena_120_generated');
        if (!isArenaGenerated) return;

        const dim = world.getDimension('overworld');
        for (const pos of SNIPER_LOCATIONS) {
            // Verificar se já tem um esqueleto no piso (raio curto de 2 blocos)
            const entities = dim.getEntities({
                location: { x: pos.x + 0.5, y: pos.y + 2, z: pos.z + 0.5 },
                maxDistance: 2,
                typeId: 'minecraft:skeleton'
            });

            // Se não tiver nenhum esqueleto na gaiola, spawnar um novo
            if (entities.length === 0) {
                dim.spawnEntity('minecraft:skeleton', {
                    x: pos.x + 0.5,
                    y: pos.y + 3,
                    z: pos.z + 0.5
                });
            }

        }
    } catch (e) {}
}, 200); // Tentar a cada 10 segundos


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
            for (let i = 0; i < 3; i++) {
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
    // Verificação de Arena (Agora integrada ao loop)
    const isArenaGenerated = world.getDynamicProperty('arena_120_generated');
    if (!isArenaGenerated) {
        console.warn('[CLANS] Detectada necessidade de Arena 120. O loop de manutencao cuidara disso.');
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
