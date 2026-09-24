# Taskboard API

Backend em Go para gestão de projetos e tarefas em formato Kanban.

## Rodando localmente

Suba o PostgreSQL pelo Compose (a senha deve ser a mesma usada no `DATABASE_URL`):

```bash
cp .env.example .env
docker compose up -d db

cd backend
export JWT_SECRET='troque-por-um-segredo-com-mais-de-32-caracteres'
export DATABASE_URL='postgres://taskboard:troque-esta-senha@localhost:5432/taskboard?sslmode=disable'
go run ./cmd/server
```

O servidor inicia em `http://localhost:8080`. As tabelas do PostgreSQL são criadas automaticamente na primeira inicialização.

Variáveis disponíveis:

- `ADDRESS`: endereço do servidor; padrão `:8080`.
- `DATABASE_URL`: URL obrigatória de conexão com o PostgreSQL.
- `JWT_SECRET`: segredo obrigatório, com pelo menos 32 caracteres.
- `CORS_ORIGIN`: origem permitida; padrão `http://localhost:3000`.
- `STUN_URLS`: URLs STUN separadas por vírgula.
- `TURN_HOST`, `TURN_PORT`, `TURN_SECRET`: dados públicos e segredo compartilhado usados para gerar credenciais temporárias do coturn.

## Autenticação

O cadastro aceita nome ou alias, email, senha, confirmação de senha e uma foto opcional em GIF, PNG ou JPG:

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"alias":"Nina","email":"voce@exemplo.com","password":"senha-segura","password_confirmation":"senha-segura","avatar_data":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="}'
```

O cadastro e o login retornam um JWT no campo `token`. Use-o nas próximas chamadas:

```text
Authorization: Bearer <token>
```

## Rotas principais

| Método | Rota | Função |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Criar usuário e iniciar sessão |
| `POST` | `/api/auth/login` | Entrar com email e senha |
| `GET` | `/api/auth/me` | Usuário autenticado |
| `PATCH` | `/api/auth/me` | Editar alias, email, senha ou foto do usuário autenticado |
| `GET` | `/api/users?q=` | Buscar usuários para adicionar à equipe |
| `GET` | `/api/projects` | Listar projetos acessíveis |
| `POST` | `/api/projects` | Criar projeto |
| `PATCH` / `DELETE` | `/api/projects/:id` | Editar ou remover projeto (proprietário) |
| `GET` | `/api/projects/:id/members` | Listar integrantes |
| `POST` | `/api/projects/:id/members` | Adicionar integrante por `user_id` ou `email` |
| `PATCH` | `/api/projects/:id/members/:userID` | Alterar permissão do integrante |
| `DELETE` | `/api/projects/:id/members/:userID` | Remover integrante |
| `POST` | `/api/projects/:id/room/ticket` | Emitir ticket temporário da sala WebRTC |
| `GET` | `/api/projects/:id/room/ws` | WebSocket de presença e sinalização WebRTC |
| `GET` | `/api/projects/:id/tasks` | Listar tarefas do projeto |
| `POST` | `/api/projects/:id/tasks` | Criar tarefa |
| `GET` / `POST` | `/api/projects/:id/labels` | Listar ou criar etiquetas do projeto |
| `GET` / `PATCH` / `DELETE` | `/api/tasks/:id` | Consultar, editar ou remover tarefa |
| `GET` / `POST` | `/api/tasks/:id/comments` | Listar ou comentar na tarefa |
| `DELETE` | `/api/task-comments/:id` | Remover comentário próprio |
| `GET` / `POST` | `/api/tasks/:id/subtasks` | Listar ou adicionar item de checklist |
| `PATCH` / `DELETE` | `/api/task-subtasks/:id` | Atualizar ou remover item de checklist |
| `GET` / `POST` | `/api/tasks/:id/attachments` | Listar ou anexar arquivo via `multipart/form-data`, campo `file` |
| `GET` / `DELETE` | `/api/task-attachments/:id` | Baixar ou remover anexo |

Status de tarefa: `backlog`, `todo`, `in_progress`, `done`. Prioridades: `low`, `medium`, `high`.

As descrições de projetos e tarefas aceitam Markdown. A criação de projeto também aceita uma imagem raster em Data URL no campo `image_data` (PNG, JPEG ou WebP, até 512 KB). No frontend, basta usar o botão “Anexar imagem”; o arquivo é lido localmente e enviado junto com o projeto.

Exemplo de criação de projeto e tarefa:

```bash
curl -X POST http://localhost:8080/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Novo produto","description":"## Objetivo\n\nMVP do produto","image_data":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="}'

curl -X POST http://localhost:8080/api/projects/<PROJECT_ID>/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Criar tela inicial","description":"**Aceite:** tela responsiva","status":"backlog","priority":"high","label_ids":["<LABEL_ID>"]}'
```

Etiquetas são compartilhadas entre as tarefas do projeto. Crie uma com `name` e uma cor da paleta `blue`, `purple`, `green`, `orange`, `red`, `cyan` ou `gray`. As tarefas retornam seus identificadores no campo `label_ids`; envie esse campo em `POST` ou `PATCH` para definir as etiquetas associadas.

O proprietário do projeto é incluído automaticamente como integrante. Integrantes podem ler tarefas; somente proprietários e editores podem alterá-las, adicionar comentários ou anexos. Cada autor pode remover seus próprios comentários. Anexos têm limite de 10 MB e são sempre enviados como download. Somente o proprietário gerencia projeto e equipe.

A sala ao vivo é temporária e permite até 10 participantes e duas telas compartilhadas. O backend não recebe nem armazena a mídia: ele apenas autentica a sala e retransmite mensagens de sinalização entre os navegadores.
