# 🎯 HABILIDADES NATIVAS REAIS - CÓDIGO ATUAL

**Baseado no código real dos clãs**

---

## 🔴 RED - Nação do Fogo

### Habilidade Nativa (TODOS):
```javascript
// Fire Resistance permanente
player.addEffect('fire_resistance', 600, { showParticles: false });
```

### Por Classe:
- **Nativo**: Fire Resistance
- **Guerreiro**: Fire Resistance + Strength I + Chance de incendiar (30%)
- **Construtor**: Fire Resistance + Haste II + Auto-Smelt (minério fundido)
- **Rei**: Fire Resistance + Aura (Resistance II + Strength II para aliados)

---

## 🔵 BLUE - Nação da Água

### Habilidade Nativa (TODOS):
```javascript
// Water Breathing + Dolphins Grace permanente
player.addEffect('water_breathing', 600, { showParticles: false });
player.addEffect('dolphins_grace', 600, { amplifier: 0, showParticles: false });

// Night Vision em água
if (player.isInWater) {
    player.addEffect('night_vision', 600, { showParticles: false });
}
```

### Por Classe:
- **Nativo**: Water Breathing + Dolphins Grace
- **Guerreiro**: + Conduit Power em água + Speed II em água + Arpão (puxar inimigos)
- **Construtor**: + Haste II/III (III em água) + Coleta Direta
- **Rei**: + Aura (Resistance II + Regeneration II para aliados)

---

## 🟢 GREEN - Nação da Terra

### Habilidade Nativa (TODOS):
```javascript
// Night Vision permanente
player.addEffect('night_vision', 600, { showParticles: false });

// Imunidade a mobs comuns (não chefes)
// Implementado em handleGreenDamageImmunity
```

### Por Classe:
- **Nativo**: Night Vision + Imunidade a mobs
- **Guerreiro**: + Regeneration I + Absorption I + Raízes (Slowness III 20% chance) + Thorns (reflexão 15%)
- **Construtor**: + Haste II/III (III em profundezas) + Colheita Farta (10% dobro) + Geólogo (drops extras)
- **Rei**: + Aura (Resistance II + Absorption II para aliados)

---

## 🟡 YELLOW - Nação do Vento

### Habilidade Nativa (TODOS):
```javascript
// Speed I permanente
player.addEffect('speed', 600, { amplifier: 0, showParticles: false });

// Fall Immunity (sem dano de queda)
// Implementado em handleYellowDamageImmunity
```

### Por Classe:
- **Nativo**: Speed I + Fall Immunity
- **Guerreiro**: + Speed II + Jump Boost II + Rajada de Vento (knockback 25%) + Esquiva Fantasma (15% desviar)
- **Construtor**: + Haste IV + Alcance do Vento
- **Rei**: + Aura (Resistance II + Speed II para aliados)

---

## 📊 RESUMO VISUAL

```
RED:
  Nativo: Fire Resistance
  Guerreiro: Strength I + Incendiar
  Construtor: Haste II + Auto-Smelt
  Rei: Aura (Res II + Str II)

BLUE:
  Nativo: Water Breathing + Dolphins Grace
  Guerreiro: Conduit Power + Speed II + Arpão
  Construtor: Haste II/III + Coleta Direta
  Rei: Aura (Res II + Regen II)

GREEN:
  Nativo: Night Vision + Mob Immunity
  Guerreiro: Regen I + Absorption I + Raízes + Thorns
  Construtor: Haste II/III + Colheita Farta + Geólogo
  Rei: Aura (Res II + Abs II)

YELLOW:
  Nativo: Speed I + Fall Immunity
  Guerreiro: Speed II + Jump Boost II + Rajada + Esquiva
  Construtor: Haste IV + Alcance
  Rei: Aura (Res II + Speed II)
```

---

## ❓ PERGUNTAS PARA BALANCEAMENTO

1. **Essas habilidades nativas estão boas?** Quer mudar algo?
2. **Qual é a FORÇA de cada clã?** (Ex: RED forte em dano, BLUE forte em água, etc)
3. **Qual é a FRAQUEZA de cada clã?** (Ex: RED fraco em defesa, YELLOW fraco em defesa, etc)

Responde essas 3 perguntas que a gente faz o balanceamento certo! 🎮

