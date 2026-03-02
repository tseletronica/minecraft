import { world } from '@minecraft/server';

// Membros do Clan GREEN com seus cargos
export const GREEN_MEMBERS = {
    // 'playerName': 'cargo' (rei, guerreiro, construtor, membro)
};

export function loadGreenMembers() {
    try {
        const saved = world.getDynamicProperty('green_members_data');
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(GREEN_MEMBERS, data);
        }
    } catch (e) { }
}

export function saveGreenMembers() {
    try {
        world.setDynamicProperty('green_members_data', JSON.stringify(GREEN_MEMBERS));
    } catch (e) { }
}

export function addGreenMember(playerName, cargo = 'membro') {
    GREEN_MEMBERS[playerName] = cargo;
    saveGreenMembers();
}

export function removeGreenMember(playerName) {
    delete GREEN_MEMBERS[playerName];
    saveGreenMembers();
}

export function getGreenMemberCargo(playerName) {
    return GREEN_MEMBERS[playerName] || null;
}

export function setGreenMemberCargo(playerName, cargo) {
    if (GREEN_MEMBERS[playerName]) {
        GREEN_MEMBERS[playerName] = cargo;
        saveGreenMembers();
        return true;
    }
    return false;
}
