# 🦅 FALCON — NEXUS.IA Brand Management

Este diretório centraliza todos os assets visuais e diretrizes de marca da plataforma **NEXUS.IA**.

## Estrutura

```
falcon/
├── logo/
│   ├── logo-icon.svg          ← Ícone hexagonal (48x48) — uso em favicons, avatares, app icons
│   ├── logo-icon.png          ← Versão raster do ícone (1024x1024)
│   ├── logo-horizontal.svg    ← Logo completa horizontal (200x48) — sidebar, header
│   ├── logo-horizontal.png    ← Versão raster horizontal
│   └── README.md              ← Este arquivo
├── colors.md                  ← Paleta de cores oficial
└── fonts.md                   ← Tipografia oficial
```

## Logos disponíveis

| Arquivo | Uso | Formato |
|---------|-----|---------|
| `logo-icon.svg` | Favicon, avatar, app icon, sidebar colapsada | SVG (escalável) |
| `logo-horizontal.svg` | Header, sidebar expandida, emails | SVG (escalável) |
| `logo-icon.png` | Onde SVG não suportado | PNG 1024×1024 |
| `logo-horizontal.png` | Impressão, apresentações | PNG |

## Onde cada logo é usada no código

| Componente | Arquivo | Logo usada |
|-----------|---------|------------|
| Sidebar (desktop) | `src/components/Sidebar.jsx` | horizontal |
| Sidebar (colapsada) | `src/components/Sidebar.jsx` | icon |
| Login | `src/pages/auth/Login.jsx` | icon + wordmark |
| Register | `src/pages/auth/Register.jsx` | icon + wordmark |
| Admin Layout | `src/components/admin/AdminLayout.jsx` | horizontal |
| Favicon | `index.html` | icon (PNG) |
| Emails (futuro) | Backend templates | horizontal |

## Componente React centralizado

```jsx
import { NexusLogo } from '../components/brand/NexusLogo';

// Apenas ícone (sidebar colapsada)
<NexusLogo variant="icon" size={32} />

// Horizontal com texto (sidebar expandida)
<NexusLogo variant="horizontal" />

// Ícone + texto em linha
<NexusLogo variant="inline" />
```

## Paleta de Cores

| Token | Hex | Uso |
|-------|-----|-----|
| `--brand-primary` | `#8b5cf6` | Violeta — cor primária da marca |
| `--brand-secondary` | `#38bdf8` | Ciano — cor de destaque/acento |
| `--brand-gradient` | `#7c3aed → #38bdf8` | Gradiente de botões e destaques |
| `--bg-dark` | `#020108` | Background principal |
| `--bg-surface` | `rgba(8,5,20,0.85)` | Cards e painéis |
| `--text-primary` | `#e2e8f0` | Texto principal |
| `--text-muted` | `#64748b` | Texto secundário |

## Como adicionar novas variações de logo

1. Criá-la nesta pasta `falcon/logo/`
2. Adicionar a variante no componente `src/components/brand/NexusLogo.jsx`
3. Registrar na tabela acima

---
*Gerenciado pelo time NEXUS.IA — Smart Moon Ltda.*
