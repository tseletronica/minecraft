import { world } from '@minecraft/server';

// Raio de proteção padrão da base (em blocos)
export const CLAN_BASE_RADIUS = 60;

// Função para carregar bases salvas (PERSISTÊNCIA)
function loadClanBase(clanKey, defaultBase, defaultDim) {
    try {
        const savedData = world.getDynamicProperty(`clan_base_${clanKey}`);
        if (savedData) {
            const data = JSON.parse(savedData);
            return { base: data.base, dimension: data.dimension };
        }
    } catch (e) { }
    return { base: defaultBase, dimension: defaultDim || 'overworld' };
}

// Configuração dos clãs (Carrega do salvo ou usa padrão)
export const CLANS = {
    red: {
        name: 'Nação do Fogo',
        color: '§c',
        tag: 'clan_red',
        descSelection: 'Resistência ao fogo e força no Nether',
        ...loadClanBase('red', { x: 42, y: 43, z: -225 }, 'nether')
    },
    blue: {
        name: 'Nação da Água',
        color: '§9',
        tag: 'clan_blue',
        descSelection: 'Respiração e velocidade na água',
        ...loadClanBase('blue', { x: -678, y: 24, z: 631 }, 'overworld')
    },
    green: {
        name: 'Nação da Terra',
        color: '§a',
        tag: 'clan_green',
        descSelection: 'Regeneração na floresta e visão noturna',
        ...loadClanBase('green', { x: -927, y: -17, z: -976 }, 'overworld')
    },
    yellow: {
        name: 'Nação do Vento',
        color: '§e',
        tag: 'clan_yellow',
        descSelection: 'Velocidade, pulo e queda leve',
        ...loadClanBase('yellow', { x: -483, y: 170, z: 509 }, 'overworld')
    },
    staff: {
        name: 'Black Clan',
        color: '§0',
        tag: 'clan_black',
        descSelection: 'Administração e Ordem',
        base: { x: 782, y: 72, z: -679 },
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

// Configuração dos Totens (Manutenção Automática)
export const TOTEM_CONFIG = [
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

// Configuração da Loja (Sistema Independente)
export const SHOP_CONFIG = {
    id: 'shop',
    location: { x: -43, y: 67, z: 54 },
    dimension: 'overworld',
    tag: 'clan_shop',
    name: '§6§lLOJA DO CLÃ',
    typeId: 'minecraft:npc'
};
