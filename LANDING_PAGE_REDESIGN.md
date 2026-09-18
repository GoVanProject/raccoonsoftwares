# Plano de melhoria da landing page da RaccoonSoftwares

## Objetivo

Transformar a landing atual em uma página de conversão mais clara para negócios de serviços que precisam reduzir trabalho manual com IA e automação.

A página deve comunicar uma oferta principal, provar que a RaccoonSoftwares sabe executá-la e levar o visitante a uma única ação: iniciar uma conversa comercial pelo WhatsApp.

## Diagnóstico da página atual

### Pontos fortes

- Identidade visual própria, com boa presença do guaxinim.
- Hero com demonstração visual de dashboard.
- Demo interativa de agent de IA.
- Estrutura responsiva para desktop e mobile.
- Alternância entre temas claro e escuro.
- Projetos reais já citados: GOVAN e Pedido Divino.

### Principais problemas

- A página tenta vender agents, CRM, páginas e produtos sob medida ao mesmo tempo.
- O hero usa duas ações concorrentes: contato e demonstração.
- “Fale conosco” não explica o que acontece depois do clique.
- O email e o Instagram atuais são placeholders.
- Métricas como projetos ativos, automações e clientes aparecem sem contexto verificável.
- A seção de projetos promete resultados, mas não apresenta resultados mensuráveis.
- Faltam uma seção explícita de problema, um processo em três etapas, FAQ e redução de risco.
- O guaxinim aparece como ilustração estática, sem comportamento ou função na narrativa.
- A implementação atual usa fonte Inter, gradientes de fundo, medidas arbitrárias e ícones desenhados localmente, em desacordo com o sistema visual definido para a landing.

## Estratégia de conversão

### Público principal

Donos e responsáveis por operações de negócios de serviços, especialmente academias, clínicas, consultórios e empresas com atendimento recorrente.

### Problema central

Leads, clientes e tarefas ficam espalhados entre WhatsApp, planilhas e sistemas que não conversam entre si. A equipe perde tempo com tarefas repetitivas e demora para agir sobre oportunidades importantes.

### Oferta

Mapeamento e implementação de agentes de IA, automações e sistemas sob medida para reduzir trabalho manual e dar mais controle à operação.

CRM, páginas e produtos digitais continuam na página como meios para entregar a transformação, não como ofertas equivalentes.

### Conversão principal

CTA: **Mapear minha automação**

Destino: URL configurada em `NEXT_PUBLIC_WHATSAPP_URL`, com mensagem inicial pré preenchida.

Click trigger: “Conversa inicial sem compromisso pelo WhatsApp.”

Não usar email provisório, `instagram.com` genérico ou links sem destino real.

## Estrutura recomendada

Escolha: **Layout A, hero clássico com seções**.

A oferta fica compreensível a partir da demonstração visual do dashboard e da demo do agent. A estrutura clássica reduz a distância entre problema, mecanismo, prova e contato.

Ordem da página:

1. Hero com promessa, público, CTA, prova curta, guaxinim interativo e dashboard.
2. Problema operacional que a empresa resolve.
3. Seção de tagline com revelação palavra por palavra.
4. Benefícios orientados a resultado.
5. Como funciona em três etapas.
6. Demonstração do agent com linguagem mais concreta.
7. Projetos e provas verificáveis.
8. FAQ para objeções.
9. CTA final igual ao CTA do hero.
10. Footer com contato real, privacidade e termos.

## Copy inicial

### Hero

Eyebrow: `IA e automação para negócios de serviços`

Headline: **Automatize sua operação sem perder o controle.**

Subheadline: “Criamos agents de IA e sistemas sob medida para negócios de serviços venderem, atenderem e operarem com menos trabalho manual.”

CTA: **Mapear minha automação**

Click trigger: “Conversa inicial sem compromisso pelo WhatsApp.”

Prova curta: “Projetos reais para academias, restaurantes e operações de atendimento.”

Remover o segundo botão do hero. A demonstração deve aparecer como prova visual, não como uma segunda conversão.

### Tagline reveal

“Menos tarefa repetitiva para sua equipe.
Mais clareza para cada decisão importante.”

O texto começa com baixa opacidade e revela cada palavra em ordem de leitura quando entra no viewport.

### Benefícios

- **Reduza trabalho manual** — automatize atendimento, follow up e rotinas internas.
- **Responda no tempo certo** — priorize leads e clientes com base em contexto real.
- **Conecte sua operação** — reúna dados, tarefas e integrações em um fluxo único.
- **Mantenha o controle** — ações importantes passam por revisão humana antes do envio.

### Como funciona

1. **Mapeamos o gargalo** — entendemos onde a operação perde tempo, contexto ou oportunidades.
2. **Construímos o primeiro fluxo** — entregamos a menor automação capaz de gerar valor real.
3. **Medimos e evoluímos** — ajustamos o sistema com base no uso e nos resultados observados.

### FAQ

#### Para quais negócios a RaccoonSoftwares trabalha?

Principalmente negócios de serviços com atendimento recorrente, vendas consultivas ou processos operacionais repetitivos.

#### O agent pode agir sozinho?

Pode executar tarefas definidas, mas ações sensíveis podem exigir aprovação humana antes do envio.

#### O agent substitui minha equipe?

Não. Ele reduz tarefas repetitivas para que a equipe se concentre em atendimento, relacionamento e decisões importantes.

#### É possível integrar com meu CRM ou sistema atual?

Sim, desde que o sistema ofereça uma integração ou acesso técnico compatível. O diagnóstico inicial define o caminho mais seguro.

#### Preciso trocar todas as ferramentas que já uso?

Não necessariamente. A prioridade é conectar e simplificar o que já funciona antes de propor uma troca.

#### Quanto custa uma implementação?

O investimento depende do número de fluxos, integrações e nível de personalização. Depois do diagnóstico, a equipe apresenta uma proposta clara.

#### Quanto tempo leva para colocar a primeira automação no ar?

O prazo depende do escopo e das integrações. O primeiro fluxo deve ser definido com clareza antes de prometer uma data.

#### Existe suporte depois da entrega?

Sim. A proposta deve informar o que está incluído em suporte, manutenção e evolução contínua.

## Prova e conteúdo real

Não publicar números inventados ou resultados sem fonte.

Para cada projeto, coletar:

- Problema antes da implementação.
- Fluxo ou sistema entregue.
- Resultado mensurável.
- Nome e cargo do cliente, quando autorizado.
- Imagem real, captura do produto ou depoimento verificável.

Enquanto esses dados não existirem, trocar “resultados de verdade” por uma descrição factual do projeto.

Exemplo: “Sistema de gestão para academia com CRM, agendamentos, planos e automações de atendimento.”

## Direção visual

- Usar uma única família tipográfica: Geist, Manrope ou Poppins. Preferência: Geist.
- Remover Inter e fontes cursivas da interface.
- Usar apenas pesos até bold ou semibold.
- Aplicar `text-wrap: balance` em headings e `text-wrap: pretty` em textos longos.
- Resolver tamanhos pela escala padrão do Tailwind, de `text-xs` a `text-9xl`.
- Usar somente os tokens de espaçamento definidos: 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80 e 96 px.
- Usar apenas raios Tailwind e aplicar a fórmula de raio interno em componentes aninhados.
- Usar fundos planos. Gradientes ficam permitidos apenas no texto do heading do hero.
- Manter o tema escuro como direção principal com `#000000`, `#181818`, `#1F1F1F`, `#272727`, `#313131` e `#131209`.
- Usar Phosphor, Solar ou Iconamoon no lugar de ícones SVG desenhados para cada caso.
- Fazer o CTA primário vencer por contraste, posição e texto.
- Transformar a navegação mobile em um menu overlay com botão que se transforma em X.

## Mascote interativo

### Recomendação

Criar uma versão própria do guaxinim atual para manter continuidade de marca. Usar o guaxinim pronto da Koboyo como fallback de implementação.

O componente `page-mascot` usa duas imagens 3×3: uma para direções da cabeça e outra para reações. A biblioteca é MIT, aceita React 18 ou superior, desativa o rastreamento sem ponteiro preciso e respeita `prefers-reduced-motion`.

Referências:

- [Página de demonstração do page-mascot](https://koboyo.com/page-mascot)
- [Repositório e documentação do page-mascot](https://github.com/nilbuild/page-mascot)

### Ativos previstos

```text
public/mascots/raccoon-directions.webp
public/mascots/raccoon-reactions.webp
```

Requisitos dos dois arquivos:

- Fundo transparente.
- Grade 3×3 com nove células alinhadas.
- Mesmo canvas, escala, linha dos ombros e posição das orelhas em todas as células.
- Direções: cima esquerda, cima, cima direita, esquerda, centro, direita, baixo esquerda, baixo e baixo direita.
- Reações: piscar, coração, brilho, surpresa, piscadela, tímido, sono, tontura e alegria.
- Paleta cinza e creme, máscara facial preservada e acabamento compatível com `public/raccoon-mascot.webp`.
- Nenhum texto, logotipo ou watermark dentro das sprites.

### Posicionamento

- Colocar o mascote interativo no topo do hero, próximo ao eyebrow.
- Remover a repetição do mascote estático nessa mesma área.
- Manter o dashboard como prova do produto.
- Usar tamanho aproximado de 128 px em desktop e 96 px em mobile.
- Usar `aria-label="Interagir com o guaxinim da RaccoonSoftwares"`.
- Em touch, manter o mascote estático e clicável.
- Em movimento reduzido, desabilitar squash e efeitos não essenciais.

### Integração prevista

```tsx
import { Mascot } from "page-mascot";

<Mascot
  directions="/mascots/raccoon-directions.webp"
  reactions="/mascots/raccoon-reactions.webp"
  size={128}
  label="guaxinim da RaccoonSoftwares"
  className="hero-mascot"
/>;
```

Fixar a versão da dependência e validar o comportamento do componente em desktop, touch e movimento reduzido.

## SEO e AEO

### Indexação

Manter a página indexável. A oferta é evergreen e tem intenção de busca compatível com IA, automação e sistemas sob medida para negócios.

### Metadata

Title: `IA e automação para negócios de serviços | RaccoonSoftwares`

Description: `A RaccoonSoftwares cria agents de IA, automações e sistemas sob medida para negócios de serviços reduzirem tarefas manuais e controlarem melhor a operação.`

Adicionar `og:image`, favicon, canonical, dados estruturados de FAQ quando as respostas forem definitivas e links internos para projetos relevantes.

## Movimento, acessibilidade e estados

- Usar reveal com `IntersectionObserver`, começando em `translate-y-16 blur-md opacity-0` e terminando em `translate-y-0 blur-0 opacity-100`.
- Usar a curva `cubic-bezier(0.32,0.72,0,1)` em transições principais.
- Não adicionar listener de scroll contínuo para animações de entrada.
- Implementar hover, active, focus, loading, empty e error em todos os elementos interativos.
- Adicionar skip link, HTML semântico, foco visível e alt text nas imagens relevantes.
- Garantir navegação por teclado no menu, CTA, demo e mascote.
- Respeitar `prefers-reduced-motion`.

## Roadmap de implementação

### P0: conversão e clareza

- Atualizar posicionamento, headline, subheadline e CTA.
- Remover CTA concorrente do hero.
- Configurar destino real do WhatsApp.
- Remover placeholders de contato.
- Reescrever a seção de projetos para aceitar provas verificáveis.
- Adicionar problema, processo, FAQ e risco reduzido.

### P1: experiência visual e mascote

- Adicionar `page-mascot` com sprites próprias ou fallback da Koboyo.
- Substituir a fonte atual por Geist.
- Tokenizar tipografia, espaçamento e raios.
- Simplificar fundos e manter gradiente apenas no heading do hero.
- Adicionar tagline reveal palavra por palavra.
- Corrigir menu mobile e estados de foco.

### P2: confiança e performance

- Adicionar cases com resultados autorizados.
- Otimizar sprites, hero e imagens para carregamento rápido.
- Adicionar metadata social, favicon, política de privacidade, termos e 404.
- Corrigir avisos de CSS relacionados a `flex-end`.
- Medir cliques no CTA, início de conversa e taxa de qualificação.

## Critérios de aceite

- Uma pessoa do público entende em cinco segundos o que a RaccoonSoftwares faz, para quem e qual é o próximo passo.
- O hero tem apenas uma ação principal visível.
- O CTA abre um destino real e contém contexto sobre o próximo passo.
- Nenhuma métrica, depoimento ou resultado sem fonte aparece como prova.
- O guaxinim acompanha o ponteiro em desktop, reage ao clique e continua acessível em touch.
- A página funciona em 390 px, 768 px e 1440 px sem sobreposição ou overflow horizontal.
- O mascote não causa movimento quando `prefers-reduced-motion` está ativo.
- Todos os links possuem destino real.
- O build Next.js continua passando após a integração.
- A landing mantém contraste AA, foco visível e navegação completa por teclado.
