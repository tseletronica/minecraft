# Entrar no clã RED
tag @s remove clan_blue
tag @s remove clan_green
tag @s remove clan_yellow
tag @s add clan_red
tellraw @s {"rawtext":[{"text":"§a✔ Você entrou no clã §c[RED]§a!"}]}
tellraw @a {"rawtext":[{"selector":"@s"},{"text":" §7entrou no §c[RED]§7!"}]}
