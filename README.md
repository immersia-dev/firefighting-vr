# Vet Anatomy VR

Projeto de visualização anatômica em realidade virtual utilizando **A-Frame**. Desenvolvido para fins educacionais e de treinamento, permitindo a exploração de diferentes camadas anatômicas de um animal em um ambiente imersivo.

## 🚀 Funcionalidades

- Visualização de múltiplos modelos anatômicos (`glb`): pele, músculos, ossos, coração, pulmões, fígado, cérebro, sistema circulatório, etc.
- Controle de movimento por:

  - **WASD** (teclado)
  - **Thumbstick do Quest 3** (via `movement-controls`)

- Suporte a VR nativo pelo navegador do Meta Quest.
- Hands / controllers com **laser raycaster** para futura interação.
- Texturização de chão e ambiente simples para navegação.

---

## 📁 Estrutura do Projeto

```
vet-anatomy/
│
├── assets/                 # Modelos GLB
├── imgs/                   # Imagens e texturas
├── scenes/
│   └── default.html        # Cena VR principal
├── scripts/
│   ├── components/         # Componentes A-Frame
│   └── lib/                # Bibliotecas A-Frame / Extras
├── index.html              # Tela inicial (menu de entrada)
├── .gitattributes          # Configuração do Git LFS
├── .gitignore              # Arquivos ignorados
└── package.json            # Scripts de desenvolvimento
```

---

## 🧩 Tecnologias

- **A-Frame 1.7.1**
- **A-Frame Extras (movement-controls / gamepad)**
- **Git LFS** para armazenamento otimizado de GLB e imagens grandes
- **Vite** para desenvolvimento com HTTPS local

---

## ▶️ Como Rodar Localmente (com HTTPS para Quest 3)

1. Instale dependências:

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
