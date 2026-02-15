# Criar scoreboard para mostrar clãs
scoreboard objectives remove clan
scoreboard objectives add clan dummy "§6Clã"
scoreboard objectives setdisplay sidebar clan

# Definir valores para cada clã
# RED = 1, BLUE = 2, GREEN = 3, YELLOW = 4

execute as @a[tag=clan_red] run scoreboard players set @s clan 1
execute as @a[tag=clan_blue] run scoreboard players set @s clan 2
execute as @a[tag=clan_green] run scoreboard players set @s clan 3
execute as @a[tag=clan_yellow] run scoreboard players set @s clan 4

say §aScoreboard de clãs configurado!
