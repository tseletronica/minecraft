import { world } from '@minecraft/server';

// Configuração de Reis por Clan (Persistente)
export const CLAN_KINGS = {
    red: null,
    blue: null,
    green: null,
    yellow: null
};

// Carregar reis salvos
export function loadClanKings() {
    try {
        const saved = world.getDynamicProperty('clan_kings_data');
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(CLAN_KINGS, data);
        }
    } catch (e) { }
}

// Salvar reis
export function saveClanKings() {
    try {
        world.setDynamicProperty('clan_kings_data', JSON.stringify(CLAN_KINGS));
    } catch (e) { }
}

// Definir rei de um clan
export function setKing(clanKey, playerName) {
    if (CLAN_KINGS.hasOwnProperty(clanKey)) {
        CLAN_KINGS[clanKey] = playerName;
        saveClanKings();
        return true;
    }
    return false;
}

// Obter rei de um clan
export function getKing(clanKey) {
    return CLAN_KINGS[clanKey] || null;
}

// Verificar se jogador é rei
export function isKing(playerName, clanKey) {
    return CLAN_KINGS[clanKey] === playerName;
}
