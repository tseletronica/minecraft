# Entrar no clã GREEN
tag @s remove clan_red
tag @s remove clan_blue
tag @s remove clan_yellow
tag @s add clan_green
tellraw @s {"rawtext":[{"text":"§a✔ Você entrou no clã §a[GREEN]§a!"}]}
tellraw @a {"rawtext":[{"selector":"@s"},{"text":" §7entrou no §a[GREEN]§7!"}]}
