// Configuração da Loja do Clã (5 Categorias)
// Estrutura:
// - id: Identificador interno
// - name: Nome no botão
// - icon: Ícone
// - items: Array de itens { name, price, command, icon }

export const SHOP_CATEGORIES = [
    {
        id: 'armas',
        name: '§cArmas\n§7Espadas, Machados e Arcos',
        icon: 'textures/items/diamond_sword',
        items: [
            // NETHERITE
            { name: 'Espada de Netherite',      price: 2500, command: 'give @s netherite_sword',        icon: 'textures/items/netherite_sword' },
            { name: 'Machado de Netherite',     price: 2500, command: 'give @s netherite_axe',          icon: 'textures/items/netherite_axe' },
            // DIAMANTE
            { name: 'Espada de Diamante',       price: 500,  command: 'give @s diamond_sword',          icon: 'textures/items/diamond_sword' },
            { name: 'Machado de Diamante',      price: 500,  command: 'give @s diamond_axe',            icon: 'textures/items/diamond_axe' },
            // FERRO
            { name: 'Espada de Ferro',          price: 100,  command: 'give @s iron_sword',             icon: 'textures/items/iron_sword' },
            { name: 'Machado de Ferro',         price: 100,  command: 'give @s iron_axe',               icon: 'textures/items/iron_axe' },
            // RANGED
            { name: 'Arco e Flecha (Kit)',      price: 200,  command: 'give @s bow 1\ngive @s arrow 64', icon: 'textures/items/bow_pulling_2' },
            { name: 'Besta e Flecha (Kit)',     price: 250,  command: 'give @s crossbow 1\ngive @s arrow 64', icon: 'textures/items/crossbow_pulling_2' },
            { name: 'Tridente',                 price: 3000, command: 'give @s trident',                icon: 'textures/items/trident' }
        ]
    },
    {
        id: 'armaduras',
        name: '§9Armaduras\n§7Proteção para Batalha',
        icon: 'textures/items/diamond_chestplate',
        items: [
            // NETHERITE
            { name: 'Set Netherite FULL',       price: 8000, command: 'give @s netherite_helmet 1\ngive @s netherite_chestplate 1\ngive @s netherite_leggings 1\ngive @s netherite_boots 1', icon: 'textures/items/netherite_chestplate' },
            { name: 'Peitoral de Netherite',    price: 3000, command: 'give @s netherite_chestplate',   icon: 'textures/items/netherite_chestplate' },
            { name: 'Calça de Netherite',       price: 2500, command: 'give @s netherite_leggings',     icon: 'textures/items/netherite_leggings' },
            // DIAMANTE
            { name: 'Set Diamante FULL',        price: 1500, command: 'give @s diamond_helmet 1\ngive @s diamond_chestplate 1\ngive @s diamond_leggings 1\ngive @s diamond_boots 1', icon: 'textures/items/diamond_chestplate' },
            { name: 'Peitoral de Diamante',     price: 500,  command: 'give @s diamond_chestplate',     icon: 'textures/items/diamond_chestplate' },
            // FERRO
            { name: 'Set Ferro FULL',           price: 300,  command: 'give @s iron_helmet 1\ngive @s iron_chestplate 1\ngive @s iron_leggings 1\ngive @s iron_boots 1', icon: 'textures/items/iron_chestplate' },
            // OUTROS
            { name: 'Escudo',                   price: 100,  command: 'give @s shield',                 icon: 'textures/items/shield' }
        ]
    },
    {
        id: 'pocoes',
        name: '§dPoções\n§7Buffs e Debuffs',
        icon: 'textures/items/potion_bottle_drinkable',
        items: [
            // Usando texturas genéricas pois as específicas (ex: heal) não existem como arquivos diretos
            { name: 'Poção Vida II (Instant)',  price: 200, command: 'give @s potion 1 21', icon: 'textures/items/potion_bottle_drinkable' },
            { name: 'Poção Força II',           price: 300, command: 'give @s potion 1 33', icon: 'textures/items/potion_bottle_drinkable' }, 
            { name: 'Poção Velocidade II',      price: 250, command: 'give @s potion 1 16', icon: 'textures/items/potion_bottle_drinkable' },
            { name: 'Poção Fogo (Resist)',      price: 200, command: 'give @s potion 1 12', icon: 'textures/items/potion_bottle_drinkable' },
            { name: 'Poção Invisibilidade',     price: 300, command: 'give @s potion 1 7',  icon: 'textures/items/potion_bottle_drinkable' },
            
            { name: 'Splash Vida II',           price: 250, command: 'give @s splash_potion 1 21', icon: 'textures/items/potion_bottle_splash' },
            { name: 'Splash Dano II',           price: 300, command: 'give @s splash_potion 1 24', icon: 'textures/items/potion_bottle_splash' }
        ]
    },
    {
        id: 'comidas',
        name: '§6Comidas\n§7Sustento',
        icon: 'textures/items/beef_cooked',
        items: [
            { name: 'Maçã Dourada (x5)',        price: 250,  command: 'give @s golden_apple 5',         icon: 'textures/items/apple_golden' },
            { name: 'Maçã Encantada (Notch)',   price: 2000, command: 'give @s apple_enchanted 1',      icon: 'textures/items/apple_golden' },
            { name: 'Cenoura Dourada (x64)',    price: 300,  command: 'give @s golden_carrot 64',       icon: 'textures/items/carrot_golden' },
            { name: 'Bife Cozido (x64)',        price: 100,  command: 'give @s cooked_beef 64',         icon: 'textures/items/beef_cooked' },
            { name: 'Pão (x64)',                price: 50,   command: 'give @s bread 64',               icon: 'textures/items/bread' }
        ]
    },
    {
        id: 'util',
        name: '§bUtilitários\n§7Raids e Construção',
        icon: 'textures/blocks/tnt_side',
        items: [
            { name: 'Totem da Imortalidade',    price: 1500, command: 'give @s totem_of_undying',       icon: 'textures/items/totem' },
            { name: 'Ender Pearl (x16)',        price: 500,  command: 'give @s ender_pearl 16',         icon: 'textures/items/ender_pearl' },
            { name: 'TNT (x16)',                price: 800,  command: 'give @s tnt 16',                 icon: 'textures/blocks/tnt_side' },
            { name: 'Obsidian (x16)',           price: 400,  command: 'give @s obsidian 16',            icon: 'textures/blocks/obsidian' },
            { name: 'Garrafa de XP (x64)',      price: 1500, command: 'give @s experience_bottle 64',   icon: 'textures/items/experience_bottle' },
            { name: 'Teia de Aranha (x16)',     price: 200,  command: 'give @s web 16',                 icon: 'textures/blocks/web' },
            { name: 'Isqueiro',                 price: 50,   command: 'give @s flint_and_steel',        icon: 'textures/items/flint_and_steel' }
        ]
    }
];
