import { world } from '@minecraft/server';

// Membros do Clan RED com seus cargos
export const RED_MEMBERS = {
    // 'playerName': 'cargo' (rei, guerreiro, construtor, membro)
};

export function loadRedMembers() {
    try {
        const saved = world.getDynamicProperty('red_members_data');
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(RED_MEMBERS, data);
        }
    } catch (e) { }
}

export function saveRedMembers() {
    try {
        world.setDynamicProperty('red_members_data', JSON.stringify(RED_MEMBERS));
    } catch (e) { }
}

export function addRedMember(playerName, cargo = 'membro') {
    RED_MEMBERS[playerName] = cargo;
    saveRedMembers();
}

export function removeRedMember(playerName) {
    delete RED_MEMBERS[playerName];
    saveRedMembers();
}

export function getRedMemberCargo(playerName) {
    return RED_MEMBERS[playerName] || null;
}

export function setRedMemberCargo(playerName, cargo) {
    if (RED_MEMBERS[playerName]) {
        RED_MEMBERS[playerName] = cargo;
        saveRedMembers();
        return true;
    }
    return false;
}
