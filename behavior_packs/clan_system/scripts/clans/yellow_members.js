import { world } from '@minecraft/server';

// Membros do Clan YELLOW com seus cargos
export const YELLOW_MEMBERS = {
    // 'playerName': 'cargo' (rei, guerreiro, construtor, membro)
};

export function loadYellowMembers() {
    try {
        const saved = world.getDynamicProperty('yellow_members_data');
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(YELLOW_MEMBERS, data);
        }
    } catch (e) { }
}

export function saveYellowMembers() {
    try {
        world.setDynamicProperty('yellow_members_data', JSON.stringify(YELLOW_MEMBERS));
    } catch (e) { }
}

export function addYellowMember(playerName, cargo = 'membro') {
    YELLOW_MEMBERS[playerName] = cargo;
    saveYellowMembers();
}

export function removeYellowMember(playerName) {
    delete YELLOW_MEMBERS[playerName];
    saveYellowMembers();
}

export function getYellowMemberCargo(playerName) {
    return YELLOW_MEMBERS[playerName] || null;
}

export function setYellowMemberCargo(playerName, cargo) {
    if (YELLOW_MEMBERS[playerName]) {
        YELLOW_MEMBERS[playerName] = cargo;
        saveYellowMembers();
        return true;
    }
    return false;
}
