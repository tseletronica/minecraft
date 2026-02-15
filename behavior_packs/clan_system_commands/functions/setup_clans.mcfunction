# Limpar todas as tags
tag @a remove clan_red
tag @a remove clan_blue
tag @a remove clan_green
tag @a remove clan_yellow

# Adicionar SophiaBlocks271 ao clã RED
tag "SophiaBlocks271" add clan_red
tellraw "SophiaBlocks271" {"rawtext":[{"text":"§c[RED] Você está no clã vermelho!"}]}

say §aClãs configurados com sucesso!
