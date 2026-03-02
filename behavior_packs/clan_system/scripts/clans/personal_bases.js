// Configuração de bases pessoais por jogador
// Formato: playerName -> { base: {x, y, z}, dimension, radius }
// Raio de 30 blocos = 30 blocos para cada lado do centro
export const PERSONAL_BASES = {
    'SixNevada63735': {
        base: { x: 780, y: 72, z: -722 },
        dimension: 'overworld',
        radius: 30
    },
    'IdleNormal81046': {
        base: { x: 820, y: 72, z: -657 },
        dimension: 'overworld',
        radius: 30
    }
};

// Função para verificar se um jogador é o dono de uma base pessoal
export function isPersonalBaseOwner(player, baseOwnerName) {
    return player.name === baseOwnerName;
}

// Função para verificar se um jogador está em uma base pessoal
export function isInPersonalBase(location, dimension, playerName) {
    const base = PERSONAL_BASES[playerName];
    if (!base) return false;
    
    // Garantir que dimId é sempre uma string sem prefixo
    let dimId = dimension;
    if (typeof dimension === 'object' && dimension.id) {
        dimId = dimension.id;
    }
    dimId = dimId.replace('minecraft:', '');
    
    const baseDim = base.dimension.replace('minecraft:', '');
    
    if (dimId !== baseDim) return false;
    
    const dist = Math.sqrt(
        (location.x - base.base.x) ** 2 +
        (location.z - base.base.z) ** 2
    );
    
    return dist < base.radius;
}

// Função para obter o dono da base pessoal em que o jogador está
export function getPersonalBaseOwner(location, dimension) {
    for (const playerName in PERSONAL_BASES) {
        if (isInPersonalBase(location, dimension, playerName)) {
            return playerName;
        }
    }
    return null;
}
