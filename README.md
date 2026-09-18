# RaccoonSoftwares Taskboard

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

Edite `.env` e troque `JWT_SECRET` e `TURN_SECRET` por segredos aleatórios. Configure `TURN_HOST` com o domínio ou IP público do servidor. Em seguida:

```bash
docker compose up -d --build
docker compose ps
```

O Nginx publica o frontend e encaminha `/api/*` para a API pela mesma porta. Por padrão, o acesso é `http://SEU_SERVIDOR/`; o healthcheck fica em `http://SEU_SERVIDOR/health`.

O serviço coturn usa a porta `3478` TCP/UDP e o intervalo UDP definido por `TURN_MIN_PORT` e `TURN_MAX_PORT` (por padrão, `49152` a `49252`). Libere essas portas no firewall. Se o servidor estiver atrás de NAT, configure também o endereço externo do coturn na infraestrutura. A sala de compartilhamento de tela exige HTTPS em produção para que o navegador permita captura de tela e microfone.

O PostgreSQL é iniciado pelo Compose e os dados ficam no volume `taskboard_postgres_data`. A API cria e atualiza as tabelas automaticamente ao iniciar.

Para atualizar uma instalação existente:

```bash
git pull
docker compose up -d --build
```

Em produção, coloque HTTPS na frente do Nginx (por exemplo, com um proxy do provedor ou Certbot) e faça backup do volume `taskboard_postgres_data`.
