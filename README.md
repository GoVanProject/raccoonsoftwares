# RaccoonTech Taskboard

Landing page em Next.js e backend em Go para organizar projetos, tarefas Kanban e integrantes de equipe.

## Subir o projeto

Terminal 1 — API:

```bash
cd backend
export JWT_SECRET='troque-por-um-segredo-com-mais-de-32-caracteres'
go run ./cmd/server
```

Terminal 2 — frontend:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Acesse `http://localhost:3000/cadastro` para criar uma conta. O cadastro usa somente email e senha, sem confirmação. Depois do login, o quadro está disponível em `http://localhost:3000/workspace`.

Detalhes das rotas e exemplos da API estão em [backend/README.md](backend/README.md).

## Deploy com Docker Compose

No servidor Linux com Docker e Compose instalados:

```bash
git clone https://github.com/GoVanProject/raccoonsoftwares.git
cd raccoonsoftwares
cp deploy/.env.server.example .env
```

Edite `.env` e troque `JWT_SECRET` por um segredo aleatório. Em seguida:

```bash
docker compose up -d --build
docker compose ps
```

O Nginx publica o frontend e encaminha `/api/*` para a API pela mesma porta. Por padrão, o acesso é `http://SEU_SERVIDOR/`; o healthcheck fica em `http://SEU_SERVIDOR/health`.

Para atualizar uma instalação existente:

```bash
git pull
docker compose up -d --build
```

Os dados da API ficam no volume Docker `taskboard_data`. Em produção, coloque HTTPS na frente do Nginx (por exemplo, com um proxy do provedor ou Certbot) e faça backup desse volume.
