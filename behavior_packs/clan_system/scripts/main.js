import { world, system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { SHOP_CATEGORIES } from './config.js';
import { executeArenaMaintenanceStep, SNIPER_LOCATIONS } from './arena.js';
import { getCastleStatus, loadCastleStructure, saveStructure } from './castle.js';
import { AUTO_STAFF } from './staff_config.js';

// === MÓDULOS DO SISTEMA DE CLÃS ===
import { CLANS, TOTEM_CONFIG, SHOP_CONFIG, CLAN_BASE_RADIUS } from './clans/clans_config.js';
import { PERSONAL_BASES, isPersonalBaseOwner, getPersonalBaseOwner } from './clans/personal_bases.js';
import { checkAdmin, getPlayerScore, addPlayerScore, getRank } from './systems/utils.js';
import { activeMenus, squireTeleportTimers, isInBase } from './systems/protection.js';
import { applyRedEffects, handleRedBreakBlock } from './clans/red_clan.js';
import { applyBlueEffects, handleBlueBreakBlock } from './clans/blue_clan.js';
import { applyGreenEffects, handleGreenBreakBlock, checkGreenStillness } from './clans/green_clan.js';
import { applyYellowEffects, handleYellowBreakBlock } from './clans/yellow_clan.js';
import { applyStaffEffects, STAFF_CLASSES } from './clans/staff_clan.js';
import './systems/combat.js';
import './systems/totems.js';
import './systems/economy.js';

// ==================================
// FUNÇÕES COMPARTILHADAS (usadas por múltiplos módulos)
// ==================================

// isInClanBase robusto (suporta Player E Block)
function isInClanBase(entityOrBlock, clanKey) {
    try {
        const clan = CLANS[clanKey];
        if (!clan || !entityOrBlock) return false;
        const loc = entityOrBlock.location;
        const bLoc = clan.base;
        if (!loc || !bLoc) return false;
        const radius = clan.overrideRadius || CLAN_BASE_RADIUS;
        let dimId = 'overworld';
        if (entityOrBlock.dimension && typeof entityOrBlock.dimension.id === 'string') {
            dimId = entityOrBlock.dimension.id;
        } else if (typeof entityOrBlock.dimension === 'string') {
            dimId = entityOrBlock.dimension;
        }
        const pDim = dimId.replace('minecraft:', '');
        const bDim = (clan.dimension || 'overworld').replace('minecraft:', '');
        if (pDim === bDim) {
            const dist = Math.sqrt((loc.x - bLoc.x) ** 2 + (loc.z - bLoc.z) ** 2);
            if (dist < radius) return true;
        }
        const dimObj = entityOrBlock.dimension?.getEntities ? entityOrBlock.dimension : null;
        if (dimObj && loc) {
            const totems = dimObj.getEntities({ location: loc, maxDistance: radius, tags: [`totem_${clanKey}`] });
            return totems.length > 0;
        }
        return false;
    } catch (e) { return false; }
}

function safeRunCommand(dimension, command) {
    try {
        if (dimension.runCommandAsync) return dimension.runCommandAsync(command).catch(() => { });
        else if (dimension.runCommand) return dimension.runCommand(command);
    } catch (e) { }
}

function tryAddTickingArea(dimension, location, name) {
    try {
        const x = Math.floor(location.x);
        const y = Math.floor(location.y);
        const z = Math.floor(location.z);
        safeRunCommand(dimension, `tickingarea remove ${name}`);
        safeRunCommand(dimension, `tickingarea add circle ${x} ${y} ${z} 4 ${name}`);
    } catch (e) { }
}

function ensureEntityAtExactPosition(dimension, typeId, selectorTags, expectedNameTag, expectedPos, extraSetupFn) {
    try {
        const candidates = dimension.getEntities({ location: expectedPos, maxDistance: 6 })
            .filter(e => e.typeId === typeId || selectorTags.some(t => e.hasTag(t)));
        if (candidates.length > 1) {
            for (let i = 1; i < candidates.length; i++) try { candidates[i].remove(); } catch (err) { }
        }
        let primary = candidates[0];
        if (!primary) {
            try {
                primary = dimension.spawnEntity(typeId, { x: expectedPos.x + 0.5, y: expectedPos.y, z: expectedPos.z + 0.5 });
            } catch (e) { return null; }
        }
        if (primary && primary.isValid()) {
            if (expectedNameTag) primary.nameTag = expectedNameTag;
            for (const t of selectorTags) if (t && !primary.hasTag(t)) primary.addTag(t);
            const loc = primary.location;
            const dist = Math.sqrt((loc.x - (expectedPos.x + 0.5)) ** 2 + (loc.z - (expectedPos.z + 0.5)) ** 2);
            if (dist > 1 || Math.abs(loc.y - expectedPos.y) > 1 || loc.y < -60) {
                try { primary.teleport({ x: expectedPos.x + 0.5, y: expectedPos.y, z: expectedPos.z + 0.5 }, { dimension }); } catch (e) { }
            }
            if (extraSetupFn) extraSetupFn(primary);
        }
        return primary;
    } catch (e) { return null; }
}

// ==================================
// ECONOMIA
// ==================================
system.runInterval(() => {
    try {
        let objective = world.scoreboard.getObjective('coins');
        if (!objective) objective = world.scoreboard.addObjective('coins', '§6Coins');
        let killObjective = world.scoreboard.getObjective('player_kills');
        if (!killObjective) world.scoreboard.addObjective('player_kills', '§cAbates');
        world.scoreboard.setObjectiveAtDisplaySlot('sidebar', { objective });
        for (const player of world.getAllPlayers()) {
            try {
                const identity = player.scoreboardIdentity;
                if (identity) world.setDynamicProperty(`name_id_${identity.id}`, player.name);
                const currentCoins = getPlayerScore(player, 'coins') ?? 0;
                const savedCoins = world.getDynamicProperty(`score_coins_${player.name}`) ?? 0;
                if (currentCoins > savedCoins) world.setDynamicProperty(`score_coins_${player.name}`, currentCoins);
                if (currentCoins < savedCoins) addPlayerScore(player, 'coins', savedCoins - currentCoins);
            } catch (e) { }
        }
    } catch (e) { }
}, 20);

// Visão Noturna da Staff
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        try {
            if (player.hasTag(CLANS.staff.tag)) {
                player.addEffect('night_vision', 400, { amplifier: 0, showParticles: false });
            }
        } catch (e) { }
    }
}, 100);



// ==================================
// SISTEMA DE SPAWN / SELEÇÃO DE CLÃ
// ==================================
function activateClanSystem(player) {
    // Só aplica AUTO_STAFF se o jogador estiver SEM clã ou se for clã 'staff' (migração/fix)
    let needsStaffAuto = AUTO_STAFF.includes(player.name);
    let hasAnyClan = false;
    for (const key in CLANS) if (player.hasTag(CLANS[key].tag)) { hasAnyClan = true; break; }

    if (needsStaffAuto && !hasAnyClan) {
        // Limpar tags antigas
        const allClanTags = ['clan_red', 'clan_blue', 'clan_green', 'clan_yellow', 'clan_default', 'clan_black'];
        const allClassTags = [
            'red_guerreiro', 'red_construtor', 'clan_king',
            'blue_guerreiro', 'blue_construtor',
            'green_guerreiro', 'green_construtor',
            'yellow_guerreiro', 'yellow_construtor',
            'staff_guerreiro', 'staff_construtor', 'staff_rei', 'staff_squire'
        ];

        allClanTags.forEach(tag => { if (player.hasTag(tag)) player.removeTag(tag); });
        allClassTags.forEach(tag => { if (player.hasTag(tag)) player.removeTag(tag); });

        player.addTag('clan_black');

        // Atribuição Profissional baseada no nome
        if (player.name === "SixNevada63735") {
            player.addTag('staff_guerreiro');
            player.sendMessage('§a[BLACK CLAN] Sincronizado como CAVALEIRO!');
        } else if (player.name === "IdleNormal81046") {
            player.addTag('staff_squire');
            player.sendMessage('§a[BLACK CLAN] Sincronizado como ESCUDEIRO!');
        } else {
            player.addTag('staff_rei');
            player.sendMessage('§a[BLACK CLAN] Sincronizado como ADMINISTRADOR (REI)!');
        }
    }

    system.runTimeout(() => {
        try {
            if (player.runCommandAsync) player.runCommandAsync('permission set @s member').catch(() => { });
        } catch (e) { }
    }, 5);

    let currentClanKey = null;
    let hasClass = false;
    for (const key in CLANS) {
        if (player.hasTag(CLANS[key].tag)) {
            currentClanKey = key;
            // Verificar se o jogador já possui uma classe ativa
            if (key === 'staff' || key === 'default') {
                hasClass = true;
            } else {
                hasClass = player.hasTag(`${key}_guerreiro`) ||
                    player.hasTag(`${key}_construtor`) ||
                    player.hasTag('clan_king');
            }
            break;
        }
    }

    if (!currentClanKey) {
        player.addTag('clan_selection_locked');
        player.addTag('movement_locked');
        player.nameTag = `§c[ BLOQUEADO ]\n§f${player.name}`;

        // IMORTALIDADE IMEDIATA
        try {
            player.addEffect('resistance', 999999, { amplifier: 255, showParticles: false });
            player.addEffect('slowness', 999999, { amplifier: 2, showParticles: false });
        } catch (e) { }

        try { player.teleport({ x: 0, y: 64, z: 0 }, { dimension: world.getDimension('overworld') }); } catch (e) { }
        system.runTimeout(() => {
            if (player.isValid) showClanSelectionMenu(player);
        }, 20);
    } else if (!hasClass) {
        // JOGADOR ANTIGO OU NOVO SEM CLASSE: Forçar escolha de função
        player.addTag('clan_selection_locked');
        player.addTag('movement_locked');

        // IMORTALIDADE IMEDIATA
        try {
            player.addEffect('resistance', 999999, { amplifier: 255, showParticles: false });
            player.addEffect('slowness', 999999, { amplifier: 2, showParticles: false });
        } catch (e) { }

        system.runTimeout(() => {
            if (player.isValid) showClassSelectionMenu(player, currentClanKey);
        }, 20);
    } else {
        const clan = CLANS[currentClanKey];
        const rank = getRank(player);
        player.nameTag = `${clan.color}[ ${rank} ]\n§f${player.name}`;
        player.sendMessage(`§7[SISTEMA] Bem-vindo, ${rank} da ${clan.name}!`);
        world.sendMessage(`${clan.color}${player.name} §7entrou.`);
    }
}

// Habilidades de cada classe por clã
const CLASS_ABILITIES = {
    red: {
        guerreiro: 'Força I + Incendiar (30%) + Fúria + Último Suspiro',
        construtor: 'Haste II + Auto-Smelt (Minério → Lingote)'
    },
    blue: {
        guerreiro: 'Velocidade II + Força I na água + Arpão + Onda de Choque',
        construtor: 'Haste III na água + Coleta Direta pro Inventário'
    },
    green: {
        guerreiro: 'Resistência I + Regen II + Absorption II + Raízes + Thorns',
        construtor: 'Haste III em profundezas + Colheita Farta + Geólogo'
    },
    yellow: {
        guerreiro: 'Velocidade II + Salto II + Rajada de Vento + Esquiva Fantasma',
        construtor: 'Haste III + Alcance do Vento (+3 blocos)'
    }
};

// Menu especial para quem já tem clã mas precisa escolher classe
async function showClassSelectionMenu(player, clanKey) {
    if (!player || activeMenus.has(player.id)) return;
    activeMenus.add(player.id);
    const clan = CLANS[clanKey];
    const abilities = CLASS_ABILITIES[clanKey] || { guerreiro: 'Habilidades de Guerreiro', construtor: 'Habilidades de Construtor' };

    const form = new ActionFormData()
        .title(`§lESCOLHA SUA FUNÇÃO`)
        .body(`§6⚔ GUERREIRO\n§8${abilities.guerreiro}\n\n§6🏗 CONSTRUTOR\n§8${abilities.construtor}`);

    form.button(`${clan.color}§l⚔ GUERREIRO`);
    form.button(`${clan.color}§l🏗 CONSTRUTOR`);

    try {
        const response = await form.show(player);
        activeMenus.delete(player.id);

        if (response.canceled) {
            system.runTimeout(() => { if (player.isValid) showClassSelectionMenu(player, clanKey); }, 10);
            return;
        }

        const selectedClass = response.selection === 0 ? 'guerreiro' : 'construtor';

        // NOVO FLUXO: Mandar para confirmação final antes de dar as tags
        system.runTimeout(() => {
            if (player.isValid) showFinalConfirmationMenu(player, clanKey, selectedClass);
        }, 5);

    } catch (e) { activeMenus.delete(player.id); }
}

async function showFinalConfirmationMenu(player, clanKey, className) {
    if (!player || activeMenus.has(player.id)) return;
    activeMenus.add(player.id);

    const clan = CLANS[clanKey];
    const classDisplayName = className === 'guerreiro' ? '⚔ GUERREIRO' : '🏗 CONSTRUTOR';

    const form = new ActionFormData()
        .title('§l§6CONFIRMAÇÃO FINAL')
        .body(`${clan.color}${clan.name}\n\n§7Você escolheu ser um §f${classDisplayName}§7.\n\n§c§lAVISO:§r §7Esta escolha é §cPERMANENTE§7 e define suas habilidades para sempre!`)
        .button('§l§a✓ CONFIRMAR')
        .button('§l§c✕ VOLTAR');

    try {
        const response = await form.show(player);
        activeMenus.delete(player.id);

        if (response.canceled || response.selection === 1) {
            system.runTimeout(() => { if (player.isValid) showClanSelectionMenu(player); }, 5);
            return;
        }

        // --- APLICAR TUDO ---
        const classTag = `${clanKey}_${className}`;
        player.addTag(clan.tag);
        player.addTag(classTag);
        player.removeTag('clan_selection_locked');
        player.removeTag('movement_locked');

        try {
            player.removeEffect('resistance');
            player.removeEffect('slowness');
        } catch (e) { }

        const rankDisplay = className.charAt(0).toUpperCase() + className.slice(1);
        player.nameTag = `${clan.color}[ ${rankDisplay} ]\n§f${player.name}`;
        player.sendMessage(`§a[SISTEMA] Bem-vindo à ${clan.color}${clan.name}§a como §f${rankDisplay}§a!`);
        world.sendMessage(`${clan.color}${player.name} §7escolheu ser §f${rankDisplay} §7na ${clan.color}${clan.name}§7.`);

    } catch (e) { activeMenus.delete(player.id); }
}

async function showClanSelectionMenu(player) {
    if (!player) return;
    if (activeMenus.has(player.id)) return;
    activeMenus.add(player.id);

    const form = new ActionFormData()
        .title('§c§lESCOLHA SUA NACAO')
        .body('§7Selecione o clã que você deseja jurar lealdade:\n');

    // Botões com cores temáticas, nomes em maiúsculas e habilidades em letras menores
    form.button(`§c§lNAÇÃO DO FOGO\n§r§8Imunidade ao fogo`);
    form.button(`§9§lNAÇÃO DA ÁGUA\n§r§8Respiração aquática`);
    form.button(`§a§lNAÇÃO DA TERRA\n§r§8Imunidade a mobs neutros`);
    form.button(`§e§lNAÇÃO DO VENTO\n§r§8Imunidade a queda`);

    try {
        const response = await form.show(player);
        activeMenus.delete(player.id);

        if (response.canceled) {
            system.runTimeout(() => {
                if (player.isValid && player.hasTag('clan_selection_locked')) showClanSelectionMenu(player);
            }, 5);
            return;
        }

        const clanKeys = ['red', 'blue', 'green', 'yellow'];
        const clanKey = clanKeys[response.selection];

        // Passo direto para a classe
        system.runTimeout(() => {
            if (player.isValid) showClassSelectionMenu(player, clanKey);
        }, 10);

    } catch (error) {
        activeMenus.delete(player.id);
    }
}

// Atualizar nomes
function updatePlayerNames() {
    try {
        for (const player of world.getAllPlayers()) {
            for (const clanKey in CLANS) {
                const clan = CLANS[clanKey];
                if (player.hasTag(clan.tag)) {
                    const rank = getRank(player, clan);
                    const displayName = `${clan.color}[ ${rank} ]\n§f${player.name}`;
                    if (player.nameTag !== displayName) player.nameTag = displayName;
                    break;
                }
            }
        }
    } catch (error) { }
}

let tickCount = 0;
system.runInterval(() => {
    tickCount++;
    if (tickCount >= 100) { tickCount = 0; updatePlayerNames(); }
}, 1);

// Spawn Handler
world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    if (!event.initialSpawn) return;
    if (!player || !player.isValid || player.isRemoved) return;
    if (player.dimension.id !== 'minecraft:overworld') return;
    player.addTag('awaiting_clan_activation');
    system.runTimeout(() => {
        if (player && player.isValid && !player.isRemoved && player.hasTag('awaiting_clan_activation')) {
            player.removeTag('awaiting_clan_activation');
            activateClanSystem(player);
        }
    }, 20); // Reduzido de 200 para 20 (1 segundo)
});

// ==================================
// SHOP
// ==================================
function showShopWelcomeMenu(player) {
    const form = new ActionFormData()
        .title('§l§6LOJA DO CLÃ')
        .body('§fSaudacoes! Aceito apenas Coins.\n\n§fOferendas (Pix) de §aR$ 1,00§f = §e1.000 Coins§f.\n§7Fale com um ADM.')
        .button('§l§aVER PRODUTOS\n§r§7Abrir Loja', 'textures/ui/store_home_icon')
        .button('§cSair', 'textures/ui/cancel');
    form.show(player).then((response) => {
        if (response.canceled || response.selection === 1) return;
        if (response.selection === 0) system.run(() => openClanShopMainMenu(player));
    }).catch(() => { });
}

function openClanShopMainMenu(player) {
    const form = new ActionFormData().title('§l§6LOJA DO CLÃ').body('§7Selecione uma categoria:');
    for (const category of SHOP_CATEGORIES) form.button(category.name, category.icon);
    form.show(player).then((response) => {
        if (response.canceled) return;
        system.run(() => openClanShopCategory(player, SHOP_CATEGORIES[response.selection]));
    }).catch(() => { });
}

function openClanShopCategory(player, category) {
    const form = new ActionFormData()
        .title(`§l${category.name.replace('\n', ' - ')}`)
        .body(`§7Saldo: §e${getPlayerScore(player, 'coins')} Coins\n§7Escolha um item:`);
    for (const item of category.items) form.button(`${item.name}\n§e${item.price} Coins`, item.icon);
    form.button('§cVoltar', 'textures/ui/arrow_dark_left_stretch');
    form.show(player).then((response) => {
        if (response.canceled) return;
        if (response.selection === category.items.length) { system.run(() => openClanShopMainMenu(player)); return; }
        buyItem(player, category.items[response.selection], category);
    }).catch(() => { });
}

function buyItem(player, item, category) {
    const balance = getPlayerScore(player, 'coins');
    if (balance < item.price) {
        player.sendMessage(`§cVoce nao tem coins suficientes! Precisa de ${item.price}.`);
        system.run(() => openClanShopCategory(player, category));
        return;
    }
    if (addPlayerScore(player, 'coins', -item.price)) {
        const commands = item.command.split('\n');
        for (const cmd of commands) if (cmd.trim().length > 0) player.runCommand(cmd.trim());
        player.sendMessage(`§aVoce comprou §f${item.name} §apor §e${item.price} Coins§a!`);
    } else {
        player.sendMessage('§cErro na transacao. Compra cancelada.');
    }
    system.run(() => openClanShopCategory(player, category));
}

// ==================================
// MANUTENÇÃO UNIFICADA
// ==================================
function maintenanceLoop() {
    try {
        const allPlayers = world.getAllPlayers();
        const badTags = ['totem_red', 'totem_blue', 'totem_green', 'totem_yellow'];
        for (const p of allPlayers) {
            for (const tag of badTags) if (p.hasTag(tag)) p.removeTag(tag);
            const slowness = p.getEffect('slowness');
            if (slowness && slowness.amplifier >= 250) p.removeEffect('slowness');
            const resistance = p.getEffect('resistance');
            if (resistance && resistance.amplifier >= 250) p.removeEffect('resistance');
            if (p.location.y < -64) { p.teleport({ x: 0, y: 100, z: 0 }); p.sendMessage('§e[SISTEMA] Resgatado do limbo!'); }

            // Escudeiro: sistema de lealdade
            if (p.hasTag('staff_squire') && !p.hasTag('staff_loyalty_off')) {
                const knights = world.getAllPlayers().filter(k => k.hasTag('staff_knight') && k.dimension.id === p.dimension.id);
                let isNearKnight = false, nearestKnight = null, minDist = 999999;
                for (const knight of knights) {
                    const dist = Math.sqrt((p.location.x - knight.location.x) ** 2 + (p.location.z - knight.location.z) ** 2);
                    if (dist < minDist) { minDist = dist; nearestKnight = knight; }
                    if (dist <= 50) { isNearKnight = true; break; }
                }
                if (knights.length > 0 && !isNearKnight) {
                    const now = Date.now();
                    if (!squireTeleportTimers.has(p.name)) {
                        squireTeleportTimers.set(p.name, now);
                        p.sendMessage('§e[LEALDADE] Você está longe do Cavaleiro! Volte em 1 minuto ou será teleportado.');
                    } else {
                        const secondsLeft = 60 - Math.floor((now - squireTeleportTimers.get(p.name)) / 1000);
                        if (secondsLeft <= 0) {
                            squireTeleportTimers.delete(p.name);
                            if (nearestKnight) {
                                p.teleport({ x: nearestKnight.location.x + 2, y: nearestKnight.location.y, z: nearestKnight.location.z + 2 }, { dimension: nearestKnight.dimension });
                                p.sendMessage('§a[LEALDADE] Teleportado para o Cavaleiro!');
                            }
                        } else if (secondsLeft % 15 === 0) {
                            p.onScreenDisplay.setActionBar(`§eTeleporte em: §f${secondsLeft}s`);
                        }
                    }
                } else {
                    if (squireTeleportTimers.has(p.name)) { squireTeleportTimers.delete(p.name); p.sendMessage('§a[LEALDADE] Você está seguro.'); }
                }
            }
        }

        for (const config of TOTEM_CONFIG) {
            try {
                const dim = world.getDimension(config.dimension);
                const loc = config.location;
                const x = Math.floor(loc.x), y = Math.floor(loc.y), z = Math.floor(loc.z);
                safeRunCommand(dim, `fill ${x - 1} ${y - 1} ${z - 1} ${x + 1} ${y - 1} ${z + 1} bedrock`);
                safeRunCommand(dim, `fill ${x - 1} ${y} ${z - 1} ${x + 1} ${y + 2} ${z + 1} air`);
                ensureEntityAtExactPosition(dim, config.typeId, [config.tag, 'totem_npc'], config.name, config.location, (entity) => {
                    if (!entity.getEffect('resistance')) entity.addEffect('resistance', 20000000, { amplifier: 255, showParticles: false });
                    if (!entity.getEffect('slowness')) entity.addEffect('slowness', 20000000, { amplifier: 255, showParticles: false });
                });
            } catch (e) { }
        }

        try {
            const shopDim = world.getDimension(SHOP_CONFIG.dimension);
            ensureEntityAtExactPosition(shopDim, SHOP_CONFIG.typeId, [SHOP_CONFIG.tag], SHOP_CONFIG.name, SHOP_CONFIG.location, (entity) => {
                if (!entity.hasTag('clan_shop')) entity.addTag('clan_shop');
                if (!entity.getEffect('resistance')) entity.addEffect('resistance', 20000000, { amplifier: 255, showParticles: false });
            });
        } catch (e) { }

        // Manutenção de Bases Pessoais (Bedrock nos marcos)
        try {
            const overworldDim = world.getDimension('overworld');
            for (const playerName in PERSONAL_BASES) {
                const base = PERSONAL_BASES[playerName];
                const loc = base.base;
                const x = Math.floor(loc.x), y = Math.floor(loc.y), z = Math.floor(loc.z);
                // Colocar bedrock no centro como marco
                safeRunCommand(overworldDim, `setblock ${x} ${y} ${z} bedrock`);
            }
        } catch (e) { }
    } catch (e) { }
}
system.runInterval(maintenanceLoop, 1200);

// === SISTEMA DE DETECÇÃO DE ÁREAS PESSOAIS ===
const playerPersonalBaseState = new Map();
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        try {
            const dimId = player.dimension.id.replace('minecraft:', '');
            const currentBaseOwner = getPersonalBaseOwner(player.location, dimId);
            const previousBaseOwner = playerPersonalBaseState.get(player.name);
            
            if (currentBaseOwner && currentBaseOwner !== previousBaseOwner) {
                // Entrou em uma base pessoal
                player.sendMessage(`§e[AVISO] Entrando em casa de §f${currentBaseOwner}§e!`);
                playerPersonalBaseState.set(player.name, currentBaseOwner);
            } else if (!currentBaseOwner && previousBaseOwner) {
                // Saiu de uma base pessoal
                player.sendMessage(`§e[AVISO] Saindo de casa de §f${previousBaseOwner}§e!`);
                playerPersonalBaseState.delete(player.name);
            }
        } catch (e) { }
    }
}, 20); // A cada segundo

// ==================================
// INTERAÇÕES E PROTEÇÃO DE BLOCOS
// ==================================
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const target = event.target;
    const player = event.player;
    if (target.hasTag('clan_shop') || target.typeId === 'minecraft:npc') {
        event.cancel = true;
        system.run(() => showShopWelcomeMenu(player));
        return;
    }
    if (target.hasTag('totem_npc')) { event.cancel = true; return; }
});

// --- Anti-Explosão em Bases ---
world.beforeEvents.explosion.subscribe((event) => {
    const { dimension, source } = event;
    const loc = source?.location || event.getImpactedBlocks()[0]?.location;
    if (!loc) return;

    // Verificar bases pessoais
    const personalBaseOwner = getCurrentPersonalBaseOwner(loc, dimension);
    if (personalBaseOwner) {
        event.cancel = true;
        return;
    }

    const baseKey = getCurrentBaseKey(loc);
    if (baseKey && baseKey !== 'default') {
        event.cancel = true;
    }
});

// --- Proteção e Habilidades de Bloco ---
world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const { player, block } = event;
    const dim = block.dimension;

    if (checkAdmin(player)) return;

    // 0. Verificação de Base Pessoal (prioridade máxima)
    const personalBaseOwner = getCurrentPersonalBaseOwner(block.location, dim);
    if (personalBaseOwner) {
        if (!isPersonalBaseOwner(player, personalBaseOwner)) {
            event.cancel = true;
            player.onScreenDisplay.setActionBar(`§cBase pessoal de ${personalBaseOwner}!`);
            return;
        }
    }

    // 1. Verificação de Proteção de Base
    const baseKey = getCurrentBaseKey(block);
    if (baseKey && baseKey !== 'default') {
        const ownerClan = CLANS[baseKey];
        const playerClanTag = ownerClan.tag;

        // Se o jogador não for do clã dono, cancela tudo (Proteção total contra invasores)
        if (!player.hasTag(playerClanTag)) {
            event.cancel = true;
            player.onScreenDisplay.setActionBar('§cTerritório Protegido!');
            return;
        }

        // Se o jogador É do clã dono, verificamos a classe
        // Apenas Construtores e Reis podem quebrar blocos
        const canBuild = player.hasTag(`${baseKey}_construtor`) || player.hasTag('clan_king');
        if (!canBuild) {
            event.cancel = true;
            player.onScreenDisplay.setActionBar('§c✖ Apenas Construtores ou Reis podem modificar a base!');
            return;
        }
    }

    // 2. Habilidades de Construtor
    // Red: Auto-Smelt
    handleRedBreakBlock(player, block, dim);

    // Green: Geólogo
    handleGreenBreakBlock(player, block, dim);

    // Blue: Coletor das Marés
    if (handleBlueBreakBlock(player, block, dim)) {
        system.runTimeout(() => {
            const items = dim.getEntities({ typeId: 'minecraft:item', location: block.location, maxDistance: 2 });
            items.forEach(item => item.teleport(player.location));
        }, 2);
    }

    // Yellow: Wind Reach
    handleYellowBreakBlock(player, block, dim);
});

// Helper para descobrir base de um bloco
function getCurrentBaseKey(blockOrLoc) {
    const loc = blockOrLoc.location || blockOrLoc;
    for (const key in CLANS) {
        if (key === 'default') continue;
        const clan = CLANS[key];
        const dist = Math.sqrt((loc.x - clan.base.x) ** 2 + (loc.z - clan.base.z) ** 2);
        if (dist < (clan.overrideRadius || CLAN_BASE_RADIUS)) return key;
    }
    return null;
}

// Helper para descobrir base pessoal de um bloco
function getCurrentPersonalBaseOwner(location, dimension) {
    const dimId = dimension.id ? dimension.id.replace('minecraft:', '') : dimension;
    for (const playerName in PERSONAL_BASES) {
        const base = PERSONAL_BASES[playerName];
        if (base.dimension.replace('minecraft:', '') !== dimId) continue;
        const dist = Math.sqrt((location.x - base.base.x) ** 2 + (location.z - base.base.z) ** 2);
        if (dist < base.radius) return playerName;
    }
    return null;
}

world.beforeEvents.playerPlaceBlock.subscribe((event) => {
    const { player, block } = event;
    if (checkAdmin(player)) return;

    // 0. Verificação de Base Pessoal (prioridade máxima)
    const personalBaseOwner = getCurrentPersonalBaseOwner(block.location, block.dimension);
    if (personalBaseOwner) {
        if (!isPersonalBaseOwner(player, personalBaseOwner)) {
            event.cancel = true;
            player.onScreenDisplay.setActionBar(`§cBase pessoal de ${personalBaseOwner}!`);
            return;
        }
    }

    const baseKey = getCurrentBaseKey(block.location);
    if (baseKey && baseKey !== 'default') {
        const ownerClan = CLANS[baseKey];
        const playerClanTag = ownerClan.tag;

        // Se o jogador não for do clã dono, cancela (Proteção total)
        if (!player.hasTag(playerClanTag)) {
            event.cancel = true;
            player.onScreenDisplay.setActionBar('§cTerritório Protegido!');
            return;
        }

        // Se o jogador É do clã dono, verificamos a classe
        // Apenas Construtores e Reis podem colocar blocos
        const canBuild = player.hasTag(`${baseKey}_construtor`) || player.hasTag('clan_king');
        if (!canBuild) {
            event.cancel = true;
            player.onScreenDisplay.setActionBar('§c✖ Apenas Construtores ou Reis podem construir na base!');
            return;
        }
    }
});

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, block } = event;
    if (checkAdmin(player)) return;

    // Verificar bases pessoais
    const personalBaseOwner = getCurrentPersonalBaseOwner(block.location, block.dimension);
    if (personalBaseOwner) {
        if (!isPersonalBaseOwner(player, personalBaseOwner)) {
            event.cancel = true;
            player.sendMessage(`§cVocê não pode interagir na base pessoal de ${personalBaseOwner}!`);
            return;
        }
    }

    for (const key in CLANS) {
        if (isInClanBase(block, key)) {
            const clan = CLANS[key];
            if (!player.hasTag(clan.tag)) { event.cancel = true; player.sendMessage(`§cVisitantes nao podem interagir na base do ${clan.color}${clan.name}§c!`); return; }
        }
    }
});

// ==================================
// ARENA
// ==================================
function isInsideArena(pos) {
    return (pos.x >= -200 && pos.x <= -140 && pos.z >= 63 && pos.z <= 123);
}
const arenaInventoryStore = new Map();
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const inArena = isInsideArena(player.location);
        const hasTag = player.hasTag('arena_participant');
        if (inArena && !hasTag) {
            try {
                const inv = player.getComponent('inventory').container;
                const savedItems = [];
                for (let i = 0; i < inv.size; i++) {
                    const item = inv.getItem(i);
                    if (item) {
                        const hasDurability = item.getComponent('durability') !== undefined;
                        if (hasDurability || item.typeId.includes('sword') || item.typeId.includes('bow') || item.typeId.includes('pickaxe')) {
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
            } catch (e) { }
        }
        if (!inArena && hasTag) {
            player.removeTag('arena_participant');
            arenaInventoryStore.delete(player.id);
        }
    }
}, 20);

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    if (arenaInventoryStore.has(player.id)) {
        const saved = arenaInventoryStore.get(player.id);
        system.runTimeout(() => {
            try {
                const inv = player.getComponent('inventory').container;
                inv.clearAll();
                for (const entry of saved.items) inv.setItem(entry.slot, entry.item);
                const equippable = player.getComponent('equippable');
                for (const slot in saved.equipment) if (saved.equipment[slot]) equippable.setEquipment(slot, saved.equipment[slot]);
                arenaInventoryStore.delete(player.id);
                player.removeTag('arena_participant');
                player.sendMessage('§a§lARENA: §fEquipamentos devolvidos!');
            } catch (e) { }
        }, 10);
    }
});

// Sistema Sniper da Arena
system.runInterval(() => {
    try {
        if (!world.getDynamicProperty('arena_120_generated')) return;
        const dim = world.getDimension('overworld');
        for (const pos of SNIPER_LOCATIONS) {
            const entities = dim.getEntities({ location: { x: pos.x + 0.5, y: pos.y + 2, z: pos.z + 0.5 }, maxDistance: 2, typeId: 'minecraft:skeleton' });
            if (entities.length === 0) dim.spawnEntity('minecraft:skeleton', { x: pos.x + 0.5, y: pos.y + 3, z: pos.z + 0.5 });
        }
    } catch (e) { }
}, 200);

// Partículas dos Totens
system.runInterval(() => {
    for (const config of TOTEM_CONFIG) {
        if (!config.aura) continue;
        try {
            const dim = world.getDimension(config.dimension);
            for (let i = 0; i < 3; i++) {
                dim.spawnParticle(config.aura, {
                    x: config.location.x + 0.5 + (Math.random() - 0.5) * 1.5,
                    y: config.location.y + 0.2 + Math.random() * 2.5,
                    z: config.location.z + 0.5 + (Math.random() - 0.5) * 1.5
                });
            }
        } catch (e) { }
    }
}, 10);

// ==================================
// COMANDOS (chatSend)
// ==================================
world.beforeEvents.chatSend.subscribe((event) => {
    try {
        const player = event.sender;
        if (!player) return;
        const message = event.message.trim();
        const msgLow = message.toLowerCase();

        // Arena commands
        const ARENA_CMDS = ['!arenastatus', '!tparena', '!gerararena120', '!resetarena', '!limpararenaantiga', '!arenapasso'];
        if (ARENA_CMDS.some(cmd => msgLow.startsWith(cmd))) {
            event.cancel = true;
            system.run(() => {
                try {
                    if (!checkAdmin(player)) { player.sendMessage('§cSem permissao!'); return; }
                    if (msgLow === '!arenastatus') {
                        const prop = world.getDynamicProperty('arena_120_generated');
                        const step = world.getDynamicProperty('arena_120_step') ?? 0;
                        player.sendMessage(`§e[ARENA] Status: §f${prop ? 'CONCLUIDA' : 'EM CONSTRUCAO'}, Passo: ${step}/15`);
                    } else if (msgLow === '!tparena') {
                        player.teleport({ x: -170, y: 68, z: 94 }, { dimension: world.getDimension('overworld') });
                        player.sendMessage('§aArena!');
                    } else if (msgLow === '!gerararena120' || msgLow === '!resetarena') {
                        world.setDynamicProperty('arena_120_generated', false);
                        world.setDynamicProperty('arena_120_step', 0);
                        player.sendMessage('§eArena reiniciada!');
                    } else if (msgLow.startsWith('!arenapasso ')) {
                        const step = parseInt(msgLow.split(' ')[1]);
                        if (!isNaN(step)) {
                            world.setDynamicProperty('arena_120_generated', false);
                            world.setDynamicProperty('arena_120_step', step);
                            try { executeArenaMaintenanceStep(step); } catch (e) { player.sendMessage(`§cErro: ${e}`); }
                        }
                    } else if (msgLow === '!limpararenaantiga') {
                        const dim = world.getDimension('overworld');
                        for (let i = -5; i < 20; i++) dim.runCommandAsync(`fill -145 ${64 + i} -55 -15 ${64 + i} 75 air`).catch(() => { });
                        player.sendMessage('§aLimpeza enviada!');
                    }
                } catch (e) { player.sendMessage(`§cErro: ${e}`); }
            });
            return;
        }

        if (msgLow === '!clan' || msgLow === '!cla') {
            event.cancel = true;
            let playerClan = null;
            for (const key in CLANS) if (player.hasTag(CLANS[key].tag)) playerClan = CLANS[key];
            player.sendMessage(playerClan ? `§7Clã: ${playerClan.color}[${playerClan.name}]` : '§cSem clã!');
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

        if (msgLow === '!forcarescolha' || msgLow === '!forcechoose') {
            event.cancel = true;
            if (!checkAdmin(player)) { player.sendMessage('§cSem permissao!'); return; }
            let hasRealClan = false;
            for (const key in CLANS) if (key !== 'default' && key !== 'staff' && player.hasTag(CLANS[key].tag)) { hasRealClan = true; break; }
            if (hasRealClan) { player.sendMessage('§cJá está em um clã!'); return; }
            if (player.hasTag(CLANS.default.tag)) player.removeTag(CLANS.default.tag);
            showClanSelectionMenu(player);
            return;
        }

        if (msgLow === '!loja' || msgLow === '!shop') {
            event.cancel = true;
            system.run(() => showShopWelcomeMenu(player));
            return;
        }

        if (message.startsWith('! ')) {
            event.cancel = true;
            const content = message.substring(1).trim();
            if (!content) return;
            let playerClan = null;
            for (const key in CLANS) if (player.hasTag(CLANS[key].tag)) playerClan = CLANS[key];
            if (!playerClan) return player.sendMessage('§cSem clã!');
            world.getAllPlayers().filter(p => p.hasTag(playerClan.tag)).forEach(m => m.sendMessage(`${playerClan.color}[CLAN] ${player.name}: §f${content}`));
            return;
        }

        if (msgLow === '!saldo' || msgLow === '!money' || msgLow === '!balance') {
            event.cancel = true;
            player.sendMessage(`§6Saldo: §a${getPlayerScore(player, 'coins')} Coins`);
            return;
        }

        if (msgLow === '!top' || msgLow === '!ranking' || msgLow === '!abates') {
            event.cancel = true;
            try {
                const killObj = world.scoreboard.getObjective('player_kills');
                if (!killObj) { player.sendMessage('§cPlacar não encontrado.'); return; }
                const rawScores = killObj.getParticipants().map(p => {
                    let name = p.displayName;
                    if (name.includes('offlineplayername') || name.includes('-')) {
                        const savedName = world.getDynamicProperty(`name_id_${p.id}`);
                        if (savedName) name = savedName;
                    }
                    return { name, score: killObj.getScore(p) };
                });
                const unifiedMap = new Map();
                for (const entry of rawScores) {
                    if (/^[0-9a-f]{8}-/.test(entry.name)) continue;
                    const cur = unifiedMap.get(entry.name) || 0;
                    if (entry.score > cur) unifiedMap.set(entry.name, entry.score);
                }
                const scores = Array.from(unifiedMap.entries()).map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score);
                player.sendMessage('§e=== RANKING DE ABATES ===');
                const colors = ['§6§l🥇', '§7§l🥈', '§6§l🥉'];
                for (let i = 0; i < 3; i++) {
                    player.sendMessage(scores[i] ? `${colors[i]} §f${i + 1}. ${scores[i].name} §7- §e${scores[i].score} abates` : `${colors[i]} §8---`);
                }
                player.sendMessage(`§fSeu rank: §a${getPlayerScore(player, 'player_kills')} abates`);
            } catch (e) { player.sendMessage('§cErro ao gerar ranking.'); }
            return;
        }

        if (msgLow.startsWith('!darmoedas') || msgLow.startsWith('!pagar') || msgLow.startsWith('!pay')) {
            event.cancel = true;
            const args = message.match(/\"([^\"]+)\"|'([^']+)'|(\S+)/g);
            if (!args || args.length < 3) { player.sendMessage('§cUso: !pagar "Nome" valor'); return; }
            const targetName = args[1].replace(/"/g, '').replace(/'/g, '');
            const amount = parseInt(args[2]);
            if (isNaN(amount) || amount <= 0) { player.sendMessage('§cValor inválido!'); return; }
            const balance = getPlayerScore(player, 'coins');
            if (balance < amount) { player.sendMessage(`§cSaldo insuficiente: ${balance} Coins`); return; }
            const targetPlayer = world.getAllPlayers().find(p => p.name === targetName);
            if (!targetPlayer) { player.sendMessage(`§cJogador "${targetName}" não encontrado!`); return; }
            if (addPlayerScore(player, 'coins', -amount)) {
                addPlayerScore(targetPlayer, 'coins', amount);
                player.sendMessage(`§aEnviou §e${amount} Coins §apara §f${targetName}§a.`);
                targetPlayer.sendMessage(`§aRecebeu §e${amount} Coins §ade §f${player.name}§a.`);
            }
            return;
        }

        if (msgLow === '!base') {
            event.cancel = true;
            let playerClan = null;
            for (const clanKey in CLANS) if (player.hasTag(CLANS[clanKey].tag)) { playerClan = CLANS[clanKey]; break; }
            if (!playerClan || playerClan.tag === CLANS.default.tag) { player.sendMessage('§cNômades não têm base!'); return; }
            const isStaff = player.hasTag(CLANS.staff.tag);
            const cost = isStaff ? 0 : 100;
            if (getPlayerScore(player, 'coins') < cost) { player.sendMessage(`§cPrecisa de ${cost} Coins!`); return; }
            system.run(() => {
                if (addPlayerScore(player, 'coins', -cost)) {
                    try {
                        player.teleport({ x: playerClan.base.x + 0.5, y: playerClan.base.y + 1, z: playerClan.base.z + 0.5 }, { dimension: world.getDimension(playerClan.dimension || 'overworld') });
                        player.sendMessage(`${playerClan.color}[CLAN] §aTeleportado para a base!`);
                    } catch (e) {
                        if (cost > 0) addPlayerScore(player, 'coins', cost);
                        player.sendMessage('§cErro ao teleportar. Custo devolvido.');
                    }
                }
            });
        }

        if (msgLow.startsWith('!tpbase ') || (msgLow.startsWith('!base-') && msgLow.split('-').length > 1)) {
            event.cancel = true;
            if (!checkAdmin(player) && !player.hasTag(CLANS.staff.tag)) return;
            const parts = msgLow.split('-');
            const clanKey = parts.length > 1 ? parts[1] : msgLow.split(' ')[1];
            const clan = CLANS[clanKey];
            if (!clan) { player.sendMessage('§cClã inválido!'); return; }
            system.run(() => {
                player.teleport({ x: clan.base.x + 0.5, y: clan.base.y + 1, z: clan.base.z + 0.5 }, { dimension: world.getDimension(clan.dimension || 'overworld') });
                player.sendMessage(`§aTeleportado para base ${clanKey}`);
            });
            return;
        }

        if (msgLow === '!staffdist') {
            event.cancel = true;
            const staff = CLANS.staff;
            const dist = Math.sqrt((player.location.x - staff.base.x) ** 2 + (player.location.z - staff.base.z) ** 2);
            const radius = staff.overrideRadius || CLAN_BASE_RADIUS;
            player.sendMessage(`§e[DEBUG] Dist Staff: §f${dist.toFixed(1)} / Raio: ${radius} / Ativo: ${dist < radius ? '§aSIM' : '§cNÃO'}`);
            return;
        }

        if (msgLow === '!lealdade') {
            event.cancel = true;
            if (!player.hasTag('staff_squire')) { player.sendMessage('§cApenas Escudeiros!'); return; }
            if (player.hasTag('staff_loyalty_off')) {
                player.removeTag('staff_loyalty_off');
                player.sendMessage('§a[LEALDADE] Teleporte ATIVADO!');
            } else {
                player.addTag('staff_loyalty_off');
                player.sendMessage('§e[LEALDADE] Teleporte DESATIVADO!');
            }
            return;
        }

        if (msgLow.startsWith('!setbase ')) {
            event.cancel = true;
            if (!checkAdmin(player)) { player.sendMessage('§cSem permissao!'); return; }
            const clanKey = msgLow.split(' ')[1];
            if (!CLANS[clanKey]) { player.sendMessage('§cClã inválido!'); return; }
            const newBase = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
            const newDim = player.dimension.id;
            system.run(() => {
                world.setDynamicProperty(`clan_base_${clanKey}`, JSON.stringify({ base: newBase, dimension: newDim }));
                CLANS[clanKey].base = newBase;
                CLANS[clanKey].dimension = newDim;
                const totem = TOTEM_CONFIG.find(t => t.id === `${clanKey}_totem`);
                if (totem) { totem.location = newBase; totem.dimension = newDim.replace('minecraft:', ''); }
                player.sendMessage(`§aBase ${CLANS[clanKey].name}: ${newBase.x}, ${newBase.y}, ${newBase.z}`);
            });
            return;
        }

        if (msgLow === '!castelostatus') {
            event.cancel = true;
            if (!checkAdmin(player)) return;
            const status = getCastleStatus();
            player.sendMessage(`§eCastelo: ${status.busy ? '§cOCUPADO' : '§aLIVRE'} | Parte: ${status.lastPart}`);
            return;
        }

        if (msgLow.startsWith('!gerar')) {
            event.cancel = true;
            if (!checkAdmin(player)) return;
            let name = '', yOffset = 0;
            const quotedMatch = message.match(/!gerar\s+"([^"]+)"(?:\s+(-?\d+))?/i);
            if (quotedMatch) { name = quotedMatch[1]; yOffset = quotedMatch[2] ? parseInt(quotedMatch[2]) : 0; }
            else { const rest = message.substring(7).trim(); const parts = rest.split(' '); const last = parts[parts.length - 1]; if (!isNaN(parseInt(last)) && parts.length > 1) { yOffset = parseInt(last); name = parts.slice(0, -1).join(' '); } else name = rest; }
            if (!name) { player.sendMessage('§cUse: !gerar <nome> [y_offset]'); return; }
            const loc = player.location;
            system.run(() => { if (!loadCastleStructure(name, Math.floor(loc.x), Math.floor(loc.y) + yOffset, Math.floor(loc.z), player)) player.sendMessage('§cSistema ocupado!'); });
            return;
        }

        if (msgLow === '!salvararena') {
            event.cancel = true;
            if (!checkAdmin(player)) return;
            system.run(() => saveStructure("arena_pvp", -200, 50, 64, -141, 100, 123, player));
            player.sendMessage('§eSalvando arena...');
            return;
        }

        if (message.startsWith('!addmoedas') || message.startsWith('!addcoins')) {
            event.cancel = true;
            if (!checkAdmin(player)) { player.sendMessage('§cSem permissao!'); return; }
            const args = message.match(/\"([^\"]+)\"|'([^']+)'|(\S+)/g);
            if (!args || args.length < 3) { player.sendMessage('§cUso: !addmoedas "Nome" valor'); return; }
            const targetName = args[1].replace(/"/g, '').replace(/'/g, '');
            const amount = parseInt(args[2]);
            const targetPlayer = world.getAllPlayers().find(p => p.name === targetName);
            if (!targetPlayer) { player.sendMessage(`§cJogador "${targetName}" não encontrado!`); return; }
            if (addPlayerScore(targetPlayer, 'coins', amount)) {
                player.sendMessage(`§a[ADMIN] +${amount} Coins para ${targetName}.`);
                targetPlayer.sendMessage(`§a+${amount} Coins da administração!`);
            }
            return;
        }

        if (message === '!clean') {
            event.cancel = true;
            if (!checkAdmin(player)) return;
            const npcs = player.dimension.getEntities({ typeId: 'minecraft:npc', location: player.location, maxDistance: 100 });
            npcs.forEach(npc => { try { npc.remove(); } catch (e) { } });
            player.sendMessage(`§a${npcs.length} NPCs removidos!`);
            return;
        }

        if (message === '!cleantotems') {
            event.cancel = true;
            if (!checkAdmin(player)) return;
            try {
                const dim = world.getDimension('overworld');
                // Remove qualquer totem órfão (não configurado)
                const allTotems = dim.getEntities({ tags: ['totem_npc'] });
                let removed = 0;
                for (const totem of allTotems) {
                    const isConfigured = TOTEM_CONFIG.some(config => 
                        Math.abs(totem.location.x - config.location.x) < 2 &&
                        Math.abs(totem.location.z - config.location.z) < 2
                    );
                    if (!isConfigured) {
                        try { totem.remove(); removed++; } catch (e) { }
                    }
                }
                player.sendMessage(`§a${removed} totem(ns) órfão(s) removido(s)!`);
            } catch (e) {
                player.sendMessage(`§cErro: ${e}`);
            }
            return;
        }

        if (message === '!checkadmin') {
            event.cancel = true;
            player.sendMessage(`§7Admin: ${checkAdmin(player) ? '§aSIM' : '§cNÃO'} | Tags: ${player.getTags().join(', ')}`);
            return;
        }

        if (message.startsWith('!setrei ')) {
            event.cancel = true;
            if (!checkAdmin(player)) return;
            const targetName = message.substring(8).trim();
            const target = world.getAllPlayers().find(p => p.name === targetName);
            if (!target) { player.sendMessage(`§cJogador "${targetName}" não encontrado!`); return; }
            let targetClan = null;
            for (const key in CLANS) if (target.hasTag(CLANS[key].tag)) { targetClan = CLANS[key]; break; }
            if (!targetClan || targetClan.tag === 'clan_staff' || targetClan.tag === 'clan_default') { player.sendMessage('§cDeve ser de uma das 4 Nações!'); return; }
            world.getAllPlayers().filter(p => p.hasTag(targetClan.tag) && p.hasTag('clan_king')).forEach(p => { p.removeTag('clan_king'); p.sendMessage('§c[AVISO] Você não é mais o Rei.'); });
            target.addTag('clan_king');
            player.sendMessage(`§a${target.name} agora é Rei da ${targetClan.name}!`);
            target.sendMessage(`§6§l[COROAÇÃO] §eVocê é Rei da ${targetClan.color}${targetClan.name}§e!`);
            system.runTimeout(() => updatePlayerNames(), 20);
            return;
        }

        if (message === '!debug') {
            event.cancel = true;
            if (!checkAdmin(player)) return;
            player.sendMessage(`§eNPCs: ${player.dimension.getEntities({ typeId: 'minecraft:npc' }).length} | Tags: ${player.getTags().join(', ')} | Pos: ${Math.floor(player.location.x)}, ${Math.floor(player.location.y)}, ${Math.floor(player.location.z)}`);
            return;
        }

        if (message.startsWith('!setclan ') || message.startsWith('!moveclan ')) {
            event.cancel = true;
            if (!checkAdmin(player)) { player.sendMessage('§cSem permissao!'); return; }
            const parts = message.split(' ');
            const targetName = parts[1];
            const clanKey = parts[2]?.toLowerCase();
            if (!CLANS[clanKey]) { player.sendMessage('§cClã inválido!'); return; }
            const target = world.getAllPlayers().find(p => p.name === targetName);
            if (!target) { player.sendMessage(`§cJogador "${targetName}" não encontrado!`); return; }
            system.run(() => {
                for (const key in CLANS) if (target.hasTag(CLANS[key].tag)) target.removeTag(CLANS[key].tag);
                target.addTag(CLANS[clanKey].tag);
                const rank = getRank(target);
                target.nameTag = `${CLANS[clanKey].color}[ ${rank} ]\n§f${target.name}`;
                player.sendMessage(`§a${targetName} → ${CLANS[clanKey].color}${CLANS[clanKey].name}`);
                target.sendMessage(`§aVocê entrou na ${CLANS[clanKey].color}${CLANS[clanKey].name}§a!`);
            });
            return;
        }

        if (msgLow.startsWith('!resetclan') || msgLow.startsWith('!removeclan')) {
            event.cancel = true;
            if (!checkAdmin(player) && !player.hasTag(CLANS.staff.tag)) return;

            const args = message.match(/\"([^\"]+)\"|'([^']+)'|(\S+)/g);
            let target = player;

            if (args && args.length > 1) {
                // Restrição: Apenas ADMIN pode mudar outros jogadores
                if (!checkAdmin(player)) return player.sendMessage('§cApenas Administradores podem resetar outros jogadores!');

                const targetName = args[1].replace(/"/g, '').replace(/'/g, '');
                target = world.getAllPlayers().find(p => p.name === targetName);
                if (!target) return player.sendMessage(`§cJogador "${targetName}" não encontrado!`);
            }

            const allClanTags = ['clan_red', 'clan_blue', 'clan_green', 'clan_yellow', 'clan_default', 'clan_black'];
            const allClassTags = [
                'red_guerreiro', 'red_construtor', 'clan_king',
                'blue_guerreiro', 'blue_construtor',
                'green_guerreiro', 'green_construtor',
                'yellow_guerreiro', 'yellow_construtor',
                'staff_guerreiro', 'staff_construtor', 'staff_rei', 'staff_squire'
            ];

            system.run(() => {
                allClanTags.forEach(tag => { if (target.hasTag(tag)) target.removeTag(tag); });
                allClassTags.forEach(tag => { if (target.hasTag(tag)) target.removeTag(tag); });

                // Força a tag clan_selection_locked para ignorar a lógica automática de login por 1 ciclo
                target.addTag('clan_selection_locked');

                player.sendMessage(`§a[SISTEMA] Clã/Classe de ${target.name} resetados!`);
                if (target.id !== player.id) target.sendMessage('§e[AVISO] Seu clã foi resetado por um administrador.');

                // Chamada direta do menu ignorando activateClanSystem (que tem travas de login)
                showClanSelectionMenu(target);
            });
            return;
        }

        if (msgLow === '!findtotems') {
            event.cancel = true;
            if (!checkAdmin(player)) return;
            for (const config of TOTEM_CONFIG) {
                const entities = world.getDimension(config.dimension).getEntities({ typeId: config.typeId });
                player.sendMessage(`§7${config.id}: ${entities.length} encontrados`);
            }
            return;
        }

    } catch (e) {
        console.warn('[CLANS] Erro no comando:', e);
    }
});

// ==================================
// INICIALIZAÇÃO
// ==================================
console.warn('[CLANS] Script main.js carregado (versão modular)');

system.runTimeout(() => {
    // world.sendMessage pode falhar se chamado no exato momento do load sem players
    try {
        world.sendMessage('§d[SISTEMA] Clãs carregado - VERSÃO 2.0 MODULAR');
    } catch (e) {
        console.warn('[CLANS] Erro ao enviar mensagem de boas-vindas:', e);
    }
}, 40); // 2 segundos após o load

system.runTimeout(() => {
    for (const config of TOTEM_CONFIG) {
        const dim = world.getDimension(config.dimension);
        tryAddTickingArea(dim, config.location, `clan_${config.tag}`);
    }
}, 100);
