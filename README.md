# 🔥 Firefighting VR Training

Experiência de treinamento em realidade virtual para combate a incêndios, desenvolvida com **A-Frame 1.7.1**. Oferece simulação realista com dois modos de movimento, sistema de estados para guiar o treinamento e feedback tátil dos controladores.

## 🎯 Objetivo

Treinar operadores em procedimentos de combate a incêndio em um ambiente VR seguro, com:
- Simulação realista de fogo e fumaça
- Seleção de modo de movimento (analógico ou teleporte)
- Estados progressivos de treinamento (avaliação → abordagem → supressão → verificação)
- Feedback tátil e visual em tempo real
- Otimizações de performance para VR

## ✨ Funcionalidades

### Movimento VR
- **Analógico**: Movimento contínuo via thumbstick esquerdo
- **Teleporte**: Teleportação via raycaster e A-Frame Extras
- Seleção via tela de boas-vindas antes de iniciar

### Sistema de Treinamento
- 6 estados de treinamento (intro → sizeup → approach → suppress → overhaul → done)
- Transições automáticas entre estados
- Feedback de progresso
- Tela de conclusão com opção de reiniciar

### Simulação Ambiental
- Fogo realista com partículas otimizadas (pre-allocated buffers)
- Fumaça subindo até o teto com distribuição realista
- Espuma de extintor com física de partículas
- Iluminação dinâmica com 5 luzes
- Ambiente 3D (chão, paredes, placeholder de hangar)

### Interface
- Componente HUD unificado (`generic-hud-panel`) para UI
- Painel com glassmorphism effect
- Botões interativos com hover effects e vibração
- HUD de estatísticas (FPS, ping, modo movimento)
- Loading screen com branding Immersia

### Otimizações
- Renderer configurado para high-performance GPU
- Shadows desativadas
- Partículas com buffers pré-alocados
- LOD (Level of Detail) para modelos 3D
- Sistema de debug condicional para logging

---

## 📁 Estrutura do Projeto

```
firefighting-vr/
├── public/
│   ├── assets/
│   │   ├── fonts/              # Fonts MSDF (Exo2)
│   │   ├── models/             # Modelos 3D (.glb)
│   │   ├── textures/           # Texturas (fire, smoke, foam)
│   │   └── imgs/               # Imagens UI
│   ├── scenes/
│   │   └── default.html        # Cena VR principal
│   └── scripts/
│       ├── components/
│       │   ├── config/
│       │   │   └── debug-config.js
│       │   ├── core/           # Funcionalidade fundamental
│       │   │   ├── text-font-setup.js
│       │   │   ├── vr-stats.js
│       │   │   ├── training-state.js
│       │   │   ├── lod-model.js
│       │   │   └── scene-manager.js
│       │   ├── ui/             # Componentes de interface
│       │   │   ├── rounded-panel.js
│       │   │   ├── glassmorphism-material.js
│       │   │   ├── generic-hud-panel.js
│       │   │   └── welcome-screen.js
│       │   ├── particles/      # Sistemas de partículas
│       │   │   ├── fire.js
│       │   │   └── foam.js
│       │   ├── movement/       # Controle de movimento
│       │   │   └── movement-controller.js
│       │   ├── deprecated/     # Componentes antigos (não usar)
│       │   │   ├── anatomy/
│       │   │   ├── hand-tracking/
│       │   │   └── *.js
│       │   └── lib/            # Bibliotecas externas
│       │       ├── aframe-v1.7.1.min.js
│       │       ├── aframe-extras.min.js
│       │       └── bootstrap/
│       └── ...
├── index.html                  # Página inicial
├── vite.config.mjs            # Config Vite
├── package.json               # Dependências
├── FOLDER-STRUCTURE.md        # Guia de organização
├── IMPLEMENTATION-SUMMARY.md  # Sumário de implementação
├── TESTING-GUIDE.md           # Guia de testes
└── README.md                  # Este arquivo
```

---

## 🧩 Tecnologias

- **A-Frame 1.7.1** - WebXR framework
- **A-Frame Extras** - teleport-controls, movement-controls
- **Three.js** - Renderização 3D
- **Vite** - Build tool e dev server com HTTPS
- **Bootstrap 5** - CSS framework (incluído)

---

## ⚡ Fluxo de Inicialização

```
index.html (Loading Screen com Immersia logo)
    ↓
default.html carrega (ordem importante):
    1. debug-config.js ⚠️ PRIMEIRO
    2. Componentes core/ui/particles/movement
    3. scene-manager.js ⚠️ ÚLTIMO
    ↓
Welcome Screen aparece
    Usuário seleciona: Analógico ou Teleporte
    ↓
Training State inicia
    Estados: intro → sizeup → approach → suppress → overhaul → done
    ↓
Completion Screen
    Opção: Reiniciar
```

---

## 🎮 Como Usar

### Na Tela de Boas-vindas
1. Selecione seu método de movimento:
   - 🎮 **Movimento Analógico**: Use thumbstick esquerdo para andar
   - 🎯 **Teleporte**: Use raycaster do controle esquerdo + trigger

2. Clique em **"▶️ INICIAR TREINAMENTO"**

### Durante o Treinamento
- **Modo Analógico**: Use thumbstick para se mover
- **Modo Teleporte**: Aponte e clique o trigger para teleportar
- **Interação**: Use raycaster do controle direito para clicar botões
- **Vibração**: Controladores vibram ao fazer hover/click

### Após Conclusão
- Clique em **"🔄 REINICIAR"** para voltar ao início

---

## 🔧 Desenvolvimento Local

### Pré-requisitos
```bash
Node.js >= 16.0.0
npm ou yarn
```

### Instalação
```bash
# Clonar repositório
git clone <repo-url>
cd firefighting-vr

# Instalar dependências
npm install
```

### Rodar Localmente
```bash
# Dev server com HTTPS
npm run dev

# Acessa em:
# http://localhost:5173 (Desktop)
# https://<seu-ip>:5173 (VR - Meta Quest)
```

### Build Produção
```bash
npm run build
npm run preview  # Preview do build
```

---

## 🐛 Debug

### Ativar Logging

Edite `public/scripts/components/config/debug-config.js`:

```javascript
window.DEBUG_CONFIG = {
  LOG_CONTROLS: true,    // Entrada do usuário
  LOG_TRAINING: true,    // Transições de estado
  LOG_PARTICLES: false,  // Partículas
  SHOW_STATS: true       // HUD de estatísticas
};
```

### Testes Rápidos

Veja [TESTING-GUIDE.md](TESTING-GUIDE.md) para:
- ✅ Teste 1: Carregar página
- ✅ Teste 2: Seleção de movimento
- ✅ Teste 3: Iniciar treinamento
- ✅ Teste 4-10: Outros testes funcionais

---

## 📊 Componentes Principais

### welcome-screen.js
Tela inicial com seleção de modo de movimento.
```javascript
// Métodos
el.components['welcome-screen'].show()
el.components['welcome-screen'].hide()

// Eventos
scene.addEventListener('selectAnalogMovement', ...)
scene.addEventListener('selectTeleportMovement', ...)
scene.addEventListener('startTraining', ...)
```

### training-state.js
Máquina de estados para guiar o treinamento.
```javascript
// Estados: intro → sizeup → approach → suppress → overhaul → done
el.components['training-state'].next()          // Próximo
el.components['training-state'].reset()         // Reiniciar
el.components['training-state'].getCurrentState() // Atual

// Eventos
// 'training-state-enter': { state: 'sizeup' }
```

### movement-controller.js
Gerencia modos de movimento (analógico/teleporte).
```javascript
el.components['movement-controller'].setMode('analog' | 'teleport')
el.components['movement-controller'].setEnabled(true | false)
el.components['movement-controller'].getMode()
```

### scene-manager.js
Orquestração de transições entre cenas.
```javascript
// Listeners:
// 'training-start'     - Inicia treinamento
// 'training-complete'  - Mostra conclusão
// 'reset-to-welcome'   - Volta ao início
```

### generic-hud-panel.js
Componente HUD unificado para painéis/botões/áudio.
```javascript
// 40+ propriedades: text, title, audio, button, haptic, animação, etc
// isButton: true para criar botões interativos
// Evento: buttonAction (nome customizado)
```

---

## 📈 Performance

### Targets
- ✅ 60 FPS mínimo em VR (WebXR)
- ✅ < 100ms latência
- ✅ Sem memory leaks

### Otimizações Implementadas
- Renderer: `powerPreference: 'high-performance'`
- Shadows: Desativadas
- Partículas: Pre-allocated buffers (100 max)
- LOD: Múltiplos níveis para modelos
- Garbage collection: Reuso de vectors/quaternions

### Monitorar
```javascript
// Ativar HUD de estatísticas
window.DEBUG_CONFIG.SHOW_STATS = true
```

---

## 📝 Documentação

- [FOLDER-STRUCTURE.md](FOLDER-STRUCTURE.md) - Guia de organização de pastas
- [IMPLEMENTATION-SUMMARY.md](IMPLEMENTATION-SUMMARY.md) - Sumário detalhado
- [TESTING-GUIDE.md](TESTING-GUIDE.md) - Guia de testes funcionais
- [COMPONENTS-CONSOLIDATION.md](COMPONENTS-CONSOLIDATION.md) - Histórico de consolidação

---

## 🎓 Próximos Passos

### Curto Prazo
- [ ] Testar no Meta Quest 3 real
- [ ] Implementar HUDs de estado de treinamento
- [ ] Adicionar interação com foam/extinguidor
- [ ] Adicionar feedback de áudio para estados

### Médio Prazo
- [ ] Integrar modelo real de hangar
- [ ] Adicionar níveis de dificuldade
- [ ] Sistema de scoring/progressão
- [ ] Salvamento de progresso

### Longo Prazo
- [ ] Multiplayer/colaboração
- [ ] Analytics de performance
- [ ] Mobile app companion
- [ ] Certificação/badges

---

## 👥 Equipe

- **Desenvolvimento**: Immersia VR
- **Treinamento**: [Especialista em Bombeiros]
- **Design**: Immersia Design Team

---

## 📄 Licença

Proprietary - Immersia VR ©2024

---

## 🤝 Suporte

Para questões técnicas ou bugs, abra uma issue no repositório.

---

**Última atualização**: Reorganização de pastas e welcome screen
**Status**: Em desenvolvimento ativa

```bash
npm install
```

2. Rode o servidor em HTTPS:

```bash
npm run dev
```

O Vite irá iniciar em algo como:

```
https://192.168.xxx.xxx:5173
```

Acesse esse endereço no navegador do Quest 3.

## 📦 Git LFS

O repositório utiliza Git LFS para lidar com arquivos pesados (`.glb`, `.png`, `.jpg`).

Se você estiver clonando ou contribuindo:

```bash
git lfs install
```

## 🐴 Créditos

Desenvolvido por **Immersia XR** em parceria com o grupo **GRUPEQUI - UFAL**.
