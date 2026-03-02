import { world } from '@minecraft/server';

// Cargos disponíveis
export const CARGO_TYPES = {
    REI: 'rei',
    GUERREIRO: 'guerreiro',
    CONSTRUTOR: 'construtor',
    MEMBRO: 'membro'
};

// Estrutura: { clanKey: { playerName: { cargo, joinDate } } }
export const CLAN_MEMBERS = {
    red: {},
    blue: {},
    green: {},
    yellow: {}
};

// Carregar membros salvos
export function loadClanMembers() {
    try {
        const saved = world.getDynamicProperty('clan_members_data');
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(CLAN_MEMBERS, data);
        }
    } catch (e) { }
}

// Salvar membros
export function saveClanMembers() {
    try {
        world.setDynamicProperty('clan_members_data', JSON.stringify(CLAN_MEMBERS));
    } catch (e) { }
}

// Adicionar membro ao clan
export function addMember(clanKey, playerName, cargo = CARGO_TYPES.MEMBRO) {
    if (!CLAN_MEMBERS[clanKey]) return false;
    CLAN_MEMBERS[clanKey][playerName] = {
        cargo: cargo,
        joinDate: new Date().toISOString()
    };
    saveClanMembers();
    return true;
}

// Remover membro do clan
export function removeMember(clanKey, playerName) {
    if (!CLAN_MEMBERS[clanKey]) return false;
    delete CLAN_MEMBERS[clanKey][playerName];
    saveClanMembers();
    return true;
}

// Obter cargo do membro
export function getMemberCargo(clanKey, playerName) {
    if (!CLAN_MEMBERS[clanKey] || !CLAN_MEMBERS[clanKey][playerName]) return null;
    return CLAN_MEMBERS[clanKey][playerName].cargo;
}

// Definir cargo do membro
export function setMemberCargo(clanKey, playerName, cargo) {
    if (!CLAN_MEMBERS[clanKey] || !CLAN_MEMBERS[clanKey][playerName]) return false;
    CLAN_MEMBERS[clanKey][playerName].cargo = cargo;
    saveClanMembers();
    return true;
}

// Listar membros do clan
export function getClanMembers(clanKey) {
    if (!CLAN_MEMBERS[clanKey]) return {};
    return CLAN_MEMBERS[clanKey];
}

// Verificar se é membro
export function isMember(clanKey, playerName) {
    return CLAN_MEMBERS[clanKey] && CLAN_MEMBERS[clanKey][playerName] !== undefined;
}

// Obter todos os membros com cargo específico
export function getMembersByCargo(clanKey, cargo) {
    if (!CLAN_MEMBERS[clanKey]) return [];
    return Object.entries(CLAN_MEMBERS[clanKey])
        .filter(([_, data]) => data.cargo === cargo)
        .map(([name, _]) => name);
}
