import json
import os

# Ler os arquivos JSON dos clãs
clans_dir = "clans"
output_file = "comandos_clans.txt"

comandos = []
comandos.append("# Comandos para configurar os clãs")
comandos.append("# Copie e cole estes comandos no console do servidor ou use um command block\n")

# Remover todas as tags primeiro
comandos.append("# Limpar todas as tags de clãs")
comandos.append("tag @a remove clan_red")
comandos.append("tag @a remove clan_blue")
comandos.append("tag @a remove clan_green")
comandos.append("tag @a remove clan_yellow\n")

# Processar cada clã
for clan_file in ["red.json", "blue.json", "green.json", "yellow.json"]:
    filepath = os.path.join(clans_dir, clan_file)
    
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            clan_data = json.load(f)
        
        clan_name = clan_data["clan_name"]
        clan_color = clan_data["clan_color"]
        members = clan_data["members"]
        
        comandos.append(f"# Clã {clan_name}")
        
        for member in members:
            # Adicionar tag do clã
            tag_name = f"clan_{clan_name.lower()}"
            comandos.append(f'tag "{member}" add {tag_name}')
            
            # Mensagem de boas-vindas
            comandos.append(f'tellraw "{member}" {{"rawtext":[{{"text":"{clan_color}Você está no clã [{clan_name}]!"}}]}}')
        
        comandos.append("")  # Linha em branco

# Adicionar comando para mostrar membros online de cada clã
comandos.append("# Ver membros online de cada clã:")
comandos.append("# execute as @a[tag=clan_red] run say Estou no RED")
comandos.append("# execute as @a[tag=clan_blue] run say Estou no BLUE")
comandos.append("# execute as @a[tag=clan_green] run say Estou no GREEN")
comandos.append("# execute as @a[tag=clan_yellow] run say Estou no YELLOW")

# Salvar comandos em arquivo
with open(output_file, 'w', encoding='utf-8') as f:
    f.write('\n'.join(comandos))

print(f"✓ Comandos gerados em: {output_file}")
print(f"\nResumo:")

# Mostrar resumo
for clan_file in ["red.json", "blue.json", "green.json", "yellow.json"]:
    filepath = os.path.join(clans_dir, clan_file)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            clan_data = json.load(f)
        print(f"  {clan_data['clan_color']}[{clan_data['clan_name']}]§r: {len(clan_data['members'])} membros")
