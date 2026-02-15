# Entrar no clã YELLOW
tag @s remove clan_red
tag @s remove clan_blue
tag @s remove clan_green
tag @s add clan_yellow
tellraw @s {"rawtext":[{"text":"§a✔ Você entrou no clã §e[YELLOW]§a!"}]}
tellraw @a {"rawtext":[{"selector":"@s"},{"text":" §7entrou no §e[YELLOW]§7!"}]}
