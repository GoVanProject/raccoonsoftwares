# Auditoria de UI — Área autenticada

Atualizada em 23/09/2026. A auditoria cobre os viewports 1440×900, 1024×768, 768×1024 e 390×844 em tema claro e escuro. Evidências automatizadas ficam em `docs/ui-audit`; cenários autenticados usam fixtures de API sem alterar payloads do backend.

| Severidade | Rota | Estado / viewport | Como reproduzir | Antes | Esperado / correção | Evidência |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | `/login` | padrão, claro/escuro, todos | Abrir a rota e alternar o tema | Container e botão usavam adaptações locais; foco e tokens divergiam | `AuthShell`, MagicCard/ShimmerButton oficiais, largura máxima de 480 px e padding mobile de 16 px | `docs/ui-audit/after/login-*.png` |
| P1 | `/cadastro` | formulário com upload e erro, 390×844 | Preencher senhas diferentes e anexar avatar | Layout e branding divergiam do login; campos de senha comprimiam | Mesmo shell do login, upload rotulado, erro anunciado e uma coluna no mobile | `docs/ui-audit/after/cadastro-*.png` |
| P0 | `/workspace` | vazio, populado e loading, ≤768 px | Abrir sem projeto e expandir navegação | Rail permanente concorria com conteúdo; seletores duplicados geravam sobreposição | Navegação única no layout; Sheet no mobile; conteúdo nunca encoberto | `docs/ui-audit/after/workspace-*.png` |
| P0 | `/workspace/[projectId]` | muitas tarefas/texto longo, 1024×768 e 390×844 | Abrir quadro populado, mover e editar tarefa | Grid podia aumentar `scrollWidth` do documento; modal não prendia foco | Só o Kanban rola horizontalmente; colunas ≥300 px; Dialog restaura foco | `docs/ui-audit/after/board-*.png` |
| P1 | `/workspace/[projectId]/team` | nomes/emails longos; visualizador, 390×844 | Abrir equipe e tentar remover membro | Select e ação podiam cortar; remoção não pedia confirmação | Linhas viram cards; ações desabilitadas por permissão; ConfirmDialog obrigatório | `docs/ui-audit/after/team-*.png` |
| P0 | `/workspace/[projectId]/prospects` | mapa/pipeline e detalhes, 768×1024 | Alternar visualização e abrir lead | Pipeline podia expandir a página; overlays sem focus trap | Tabs, pipeline contido, métricas NumberTicker e Dialog acessível | `docs/ui-audit/after/prospects-*.png` |
| P0 | `/workspace/[projectId]/room` | vazia/1/2 telas, 390×844 | Entrar na sala e compartilhar tela | Navegação e controles competiam com vídeo; controles podiam sair da viewport | Vídeo prioritário, grid 1/2 telas e controles sticky no mobile | `docs/ui-audit/after/room-*.png` |
| P1 | `/workspace/profile` | loading/saving/sucesso/erro, 390×844 | Editar perfil e senha | Rail duplicado e formulário sem fundação visual comum | Shell único, estados explícitos, upload e campos responsivos | `docs/ui-audit/after/profile-*.png` |
| P1 | todas | teclado e movimento reduzido | Navegar por Tab; habilitar `prefers-reduced-motion` | Foco variava e shimmer permanecia contínuo | Ring visível; animações e shimmer reduzidos por media query | teste Playwright + axe |
| P2 | todas | todos | Comparar ícones e tipografia | SVG próprio, emoji e pesos 750/800 misturados | Phosphor como biblioteca única e Geist na área autenticada | revisão visual |

## Critérios automatizados

- `npm run lint`: ESLint CLI não interativo.
- `npm run typecheck`: TypeScript sem emissão.
- `npm run build`: build de produção.
- `npm run test:e2e`: smoke responsivo, foco de Dialog, persistência de tema, overflow e axe crítico.
- Overflow permitido somente em `.kanban-grid` e `.prospects-pipeline`.

## Observações de rollout

- URLs, `taskboard_token`, contratos HTTP, Leaflet, drag and drop e WebRTC permanecem inalterados.
- O Compose segue responsável apenas por API e banco. O frontend deve ser atualizado pelo Dockerfile raiz, sem `--remove-orphans`.
- Rollback: reutilizar a imagem frontend anterior; não remover volumes nem containers de banco.
