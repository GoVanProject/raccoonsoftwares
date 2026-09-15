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

## Autenticação

O cadastro não exige confirmação de email nem repetição de senha. Envie somente email e senha:

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"voce@exemplo.com","password":"senha-segura"}'
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
| `GET` | `/api/users?q=` | Buscar usuários para adicionar à equipe |
| `GET` | `/api/projects` | Listar projetos acessíveis |
| `POST` | `/api/projects` | Criar projeto |
| `PATCH` / `DELETE` | `/api/projects/:id` | Editar ou remover projeto (proprietário) |
| `GET` | `/api/projects/:id/members` | Listar integrantes |
| `POST` | `/api/projects/:id/members` | Adicionar integrante por `user_id` ou `email` |
| `DELETE` | `/api/projects/:id/members/:userID` | Remover integrante |
| `GET` | `/api/projects/:id/tasks` | Listar tarefas do projeto |
| `POST` | `/api/projects/:id/tasks` | Criar tarefa |
| `GET` / `PATCH` / `DELETE` | `/api/tasks/:id` | Consultar, editar ou remover tarefa |

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
  -d '{"title":"Criar tela inicial","description":"**Aceite:** tela responsiva","status":"backlog","priority":"high"}'
```

O proprietário do projeto é incluído automaticamente como integrante. Apenas integrantes podem ler e editar tarefas; somente o proprietário gerencia projeto e equipe. Projetos podem ser editados pelo proprietário, e tarefas podem ser editadas por qualquer integrante.
