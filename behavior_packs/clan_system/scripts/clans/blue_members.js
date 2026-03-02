import { world } from '@minecraft/server';

// Membros do Clan BLUE com seus cargos
export const BLUE_MEMBERS = {
    // 'playerName': 'cargo' (rei, guerreiro, construtor, membro)
};

export function loadBlueMembers() {
    try {
        const saved = world.getDynamicProperty('blue_members_data');
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(BLUE_MEMBERS, data);
        }
    } catch (e) { }
}

export function saveBlueMembers() {
    try {
        world.setDynamicProperty('blue_members_data', JSON.stringify(BLUE_MEMBERS));
    } catch (e) { }
}

export function addBlueMember(playerName, cargo = 'membro') {
    BLUE_MEMBERS[playerName] = cargo;
    saveBlueMembers();
}

export function removeBlueMember(playerName) {
    delete BLUE_MEMBERS[playerName];
    saveBlueMembers();
}

export function getBlueMemberCargo(playerName) {
    return BLUE_MEMBERS[playerName] || null;
}

export function setBlueMemberCargo(playerName, cargo) {
    if (BLUE_MEMBERS[playerName]) {
        BLUE_MEMBERS[playerName] = cargo;
        saveBlueMembers();
        return true;
    }
    return false;
}
