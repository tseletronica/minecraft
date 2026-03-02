# ⚖️ BALANCEAMENTO - CADA CLÃ ÚNICO

**Conceito**: Cada clã é BOM em algo, FRACO em outro. Não precisam ser iguais.

---

## 🔴 RED - FEROZ (Atacante Puro)

### Identidade:
```
RED é o MAIS FEROZ - Dano máximo, sem defesa
```

### Habilidades Atuais:
- Fire Resistance (nativo)
- Strength I (Guerreiro)
- Haste II (Construtor)
- Incendiar 30% (Guerreiro)
- Auto-Smelt (Construtor)

### Balanceamento Proposto:
```javascript
// MANTER TUDO IGUAL - RED já é bom em dano
// Não precisa mudar nada

// RED é FRACO em:
// - Defesa (sem Resistance)
// - Mobilidade (sem Speed)
// - Cura (sem Regeneration)
// - Água (sem bônus aquático)

// RED é BOM em:
// - Dano (Strength I + Incendiar)
// - Mineração (Haste II + Auto-Smelt)
// - Ambiente (Fire Resistance)
```

### Resultado:
- ✅ RED é o mais FEROZ
- ❌ RED é fraco em defesa
- ✅ Identidade clara

---

## 🔵 BLUE - VERSÁTIL (Dominador Aquático + Curador)

### Identidade:
```
BLUE é o MAIS VERSÁTIL - Forte em água, cura e controle
```

### Habilidades Atuais:
- Water Breathing (nativo)
- Dolphins Grace (nativo)
- Conduit Power em água (Guerreiro)
- Speed II em água (Guerreiro)
- Haste II/III (Construtor)
- Arpão (Guerreiro)
- Onda de Choque (Guerreiro)

### Balanceamento Proposto:
```javascript
// ADICIONAR em terra:
// Regeneration I permanente (para não ser fraco em terra)

// MANTER em água:
// Tudo igual - BLUE já é bom em água

// BLUE é FRACO em:
// - Dano (sem Strength)
// - Defesa em terra (sem Resistance)
// - Mobilidade em terra (sem Speed)

// BLUE é BOM em:
// - Água (Conduit + Speed II + Dolphins Grace)
// - Cura (Regeneration II no Rei)
// - Controle (Arpão + Onda de Choque)
// - Mineração em água (Haste III)
```

### Mudança Necessária:
```javascript
// Adicionar em applyBlueEffects():
if (!player.isInWater) {
    player.addEffect('regeneration', 600, { amplifier: 0, showParticles: false }); // Regen I
}
```

### Resultado:
- ✅ BLUE é o mais VERSÁTIL
- ✅ Bom em água E em terra
- ✅ Identidade clara

---

## 🟢 GREEN - TANK (Defesa Máxima)

### Identidade:
```
GREEN é o MAIS TANK - Defesa máxima, sem dano
```

### Habilidades Atuais:
- Night Vision (nativo)
- Mob Immunity (nativo)
- Regeneration I (Guerreiro)
- Absorption I (Guerreiro)
- Raízes 20% (Guerreiro)
- Thorns 15% (Guerreiro)
- Haste II/III (Construtor)
- Colheita Farta (Construtor)
- Geólogo (Construtor)

### Balanceamento Proposto:
```javascript
// AUMENTAR defesa do Guerreiro:
// - Adicionar Resistance I
// - Aumentar Regeneration I → II
// - Aumentar Absorption I → II

// AUMENTAR controle:
// - Raízes: 20% → 25%
// - Adicionar Weakness ao efeito de Raízes

// GREEN é FRACO em:
// - Dano (sem Strength)
// - Mobilidade (sem Speed)
// - Cura rápida (Regen II é lento)

// GREEN é BOM em:
// - Defesa (Resistance I + Absorption II)
// - Regeneração (Regen II)
// - Controle (Raízes + Weakness)
// - Mineração (Haste II/III + Geólogo)
```

### Mudanças Necessárias:
```javascript
// Em applyGreenEffects() - Guerreiro:
if (player.hasTag('green_guerreiro')) {
    player.addEffect('resistance', 600, { amplifier: 0, showParticles: false }); // Resistance I (NOVO)
    player.addEffect('regeneration', 600, { amplifier: 1, showParticles: false }); // Regen II (era I)
    player.addEffect('absorption', 600, { amplifier: 1, showParticles: false });   // Absorption II (era I)
}

// Em handleGreenCombat() - Raízes:
if (Math.random() < 0.25) { // Era 0.20
    victim.addEffect('slowness', 40, { amplifier: 3, showParticles: true });
    if (Math.random() < 0.50) { // NOVO
        victim.addEffect('weakness', 100, { amplifier: 0, showParticles: true });
    }
}
```

### Resultado:
- ✅ GREEN é o mais TANK
- ✅ Defesa máxima
- ✅ Identidade clara

---

## 🟡 YELLOW - RÁPIDO (Mobilidade Máxima)

### Identidade:
```
YELLOW é o MAIS RÁPIDO - Mobilidade máxima, sem defesa
```

### Habilidades Atuais:
- Speed I (nativo)
- Fall Immunity (nativo)
- Speed II (Guerreiro)
- Jump Boost II (Guerreiro)
- Haste IV (Construtor)
- Rajada de Vento (Guerreiro)
- Esquiva Fantasma 15% (Guerreiro)

### Balanceamento Proposto:
```javascript
// REDUZIR Haste IV para Haste III:
// - Haste IV é muito absurdo (16x mais rápido)
// - Haste III é bom o suficiente (8x mais rápido)

// MANTER mobilidade:
// - Speed II + Jump Boost II + Fall Immunity
// - YELLOW continua sendo o mais rápido

// YELLOW é FRACO em:
// - Defesa (sem Resistance)
// - Dano (sem Strength)
// - Cura (sem Regeneration)
// - Combate prolongado (não aguenta)

// YELLOW é BOM em:
// - Mobilidade (Speed II + Jump Boost II + Fall Immunity)
// - Mineração (Haste III)
// - Escape (impossível alcançar)
// - Construção (Haste III)
```

### Mudança Necessária:
```javascript
// Em applyYellowEffects() - Construtor:
if (player.hasTag('yellow_construtor')) {
    player.addEffect('haste', 600, { amplifier: 2, showParticles: false }); // Haste III (era IV)
}
```

### Resultado:
- ✅ YELLOW é o mais RÁPIDO
- ✅ Mobilidade máxima
- ✅ Identidade clara

---

## 📊 MATRIZ FINAL

```
                DANO    DEFESA  MOBILIDADE  CURA    MINERAÇÃO  CONTROLE
RED             ⭐⭐⭐   ❌      ❌          ❌      ⭐⭐       ❌
BLUE            ❌      ⭐⭐    ⭐⭐⭐       ⭐⭐    ⭐⭐⭐      ⭐⭐
GREEN           ❌      ⭐⭐⭐   ❌          ⭐⭐    ⭐⭐⭐      ⭐⭐⭐
YELLOW          ❌      ❌      ⭐⭐⭐       ❌      ⭐⭐⭐      ⭐
```

---

## 🎮 QUEM VENCE QUEM

### RED vs BLUE:
- ✅ Em terra: RED vence (mais dano)
- ❌ Em água: BLUE vence (domínio aquático)

### RED vs GREEN:
- ✅ Rápido: RED vence (mais dano)
- ❌ Prolongado: GREEN vence (defesa + regen)

### RED vs YELLOW:
- ✅ Combate: RED vence (mais dano)
- ❌ Fuga: YELLOW vence (muito mais rápido)

### BLUE vs GREEN:
- ✅ Em água: BLUE vence (velocidade)
- ❌ Em terra: GREEN vence (defesa)

### BLUE vs YELLOW:
- ✅ Combate: BLUE vence (controle + regen)
- ❌ Fuga: YELLOW vence (muito mais rápido)

### GREEN vs YELLOW:
- ✅ Combate: GREEN vence (defesa)
- ❌ Fuga: YELLOW vence (muito mais rápido)

---

## ✅ CADA CLÃ É ÚNICO

### 🔴 RED - FEROZ
- Especialidade: **Dano máximo**
- Fraqueza: Defesa
- Estilo: Atacante puro

### 🔵 BLUE - VERSÁTIL
- Especialidade: **Água + Cura + Controle**
- Fraqueza: Dano
- Estilo: Dominador aquático

### 🟢 GREEN - TANK
- Especialidade: **Defesa máxima**
- Fraqueza: Dano e mobilidade
- Estilo: Tanque defensivo

### 🟡 YELLOW - RÁPIDO
- Especialidade: **Mobilidade máxima**
- Fraqueza: Defesa
- Estilo: Assassino/Fugitivo

---

## 🔧 MUDANÇAS NECESSÁRIAS

### BLUE:
```javascript
// Adicionar Regen I em terra
if (!player.isInWater) {
    player.addEffect('regeneration', 600, { amplifier: 0, showParticles: false });
}
```

### GREEN:
```javascript
// Aumentar defesa do Guerreiro
player.addEffect('resistance', 600, { amplifier: 0, showParticles: false }); // Resistance I
player.addEffect('regeneration', 600, { amplifier: 1, showParticles: false }); // Regen II
player.addEffect('absorption', 600, { amplifier: 1, showParticles: false });   // Absorption II

// Melhorar Raízes
if (Math.random() < 0.25) {
    victim.addEffect('slowness', 40, { amplifier: 3, showParticles: true });
    if (Math.random() < 0.50) {
        victim.addEffect('weakness', 100, { amplifier: 0, showParticles: true });
    }
}
```

### YELLOW:
```javascript
// Reduzir Haste IV para III
player.addEffect('haste', 600, { amplifier: 2, showParticles: false }); // Haste III
```

### RED:
```javascript
// Nenhuma mudança necessária - RED já é bom em dano
```

---

## 📝 CONCLUSÃO

Com este balanceamento:

✅ **Cada clã é ÚNICO**
- RED é o mais FEROZ
- BLUE é o mais VERSÁTIL
- GREEN é o mais TANK
- YELLOW é o mais RÁPIDO

✅ **Cada clã é BOM em algo**
- RED: Dano
- BLUE: Água + Cura
- GREEN: Defesa
- YELLOW: Mobilidade

✅ **Cada clã é FRACO em algo**
- RED: Defesa
- BLUE: Dano
- GREEN: Dano + Mobilidade
- YELLOW: Defesa

✅ **Nenhum clã é superior**
- Cada um tem vantagens e desvantagens
- PvP é estratégico
- Cada um tem identidade clara

**Resultado**: Sistema balanceado e divertido! 🎮

