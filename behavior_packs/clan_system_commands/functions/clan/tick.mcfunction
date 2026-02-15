# Atualizar nomes dos jogadores com prefixo do clã a cada tick
execute as @a[tag=clan_red] run titleraw @s actionbar {"rawtext":[{"text":"§c[RED]"}]}
execute as @a[tag=clan_blue] run titleraw @s actionbar {"rawtext":[{"text":"§9[BLUE]"}]}
execute as @a[tag=clan_green] run titleraw @s actionbar {"rawtext":[{"text":"§a[GREEN]"}]}
execute as @a[tag=clan_yellow] run titleraw @s actionbar {"rawtext":[{"text":"§e[YELLOW]"}]}
