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

O `.env.example` está preenchido com os hostnames de produção. Para executar tudo localmente, sobrescreva `NEXT_PUBLIC_API_URL` em `.env.local` com `http://localhost:8080` e use `TURN_HOST=localhost` e `STUN_URLS=stun:localhost:3478` no ambiente do backend local.

Acesse `http://localhost:3000/cadastro` para criar uma conta. O cadastro usa somente email e senha, sem confirmação. Depois do login, o quadro está disponível em `http://localhost:3000/workspace`.

Detalhes das rotas e exemplos da API estão em [backend/README.md](backend/README.md).

## Deploy com Docker Compose

No servidor Linux com Docker e Compose instalados:

```bash
git clone https://github.com/GoVanProject/raccoonsoftwares.git
cd raccoonsoftwares
cp deploy/.env.server.example .env
```

Edite `.env` e troque `JWT_SECRET` e `TURN_SECRET` por segredos aleatórios. Em produção, mantenha `CORS_ORIGIN` exatamente igual à origem que entrega o frontend, por exemplo `https://raccoonsoftwares.com`, e use `NEXT_PUBLIC_API_URL=https://api.raccoonsoftwares.com`. Configure `TURN_HOST` e `STUN_URLS` com `api.raccoonsoftwares.com`. Valide a interpolação sem imprimir o conteúdo do arquivo:

```bash
docker compose config --quiet
```

Com a validação concluída, atualize a aplicação:

```bash
docker compose up -d --build
docker compose ps
```

O serviço `api` possui labels Docker para ser descoberto pelo Traefik já existente. Elas usam o router `api.raccoonsoftwares.com`, o entrypoint `websecure`, o resolver `letsencrypt` e a porta interna `8080`. O Compose não cria rede externa nem altera o modo de rede do Traefik.

O Nginx continua publicando o frontend e encaminhando `/api/*` para a API pela mesma rede interna. Como o Traefik existente usa `network_mode: host` e precisa das portas 80 e 443, confirme na VPS antes de atualizar a Stack se o `proxy` ainda publica a porta 80. Não remova o Nginx nem altere `HTTP_PORT` sem confirmar como o domínio principal está sendo servido. Se houver conflito, ajuste o binding do proxy e o roteamento do frontend de forma coordenada no Portainer.

O healthcheck interno da API é `http://127.0.0.1:8080/health`. Depois de configurar o DNS e atualizar a Stack, valide externamente com:

```bash
curl -i https://api.raccoonsoftwares.com/health
curl -Iv https://api.raccoonsoftwares.com/
```

O serviço coturn usa a porta `3478` TCP/UDP e o intervalo UDP definido por `TURN_MIN_PORT` e `TURN_MAX_PORT` (por padrão, `49152` a `49252`). Libere essas portas no firewall. Se o servidor estiver atrás de NAT, configure também o endereço externo do coturn na infraestrutura. A sala de compartilhamento de tela exige HTTPS em produção para que o navegador permita captura de tela e microfone.

O PostgreSQL é iniciado pelo Compose e os dados ficam no volume `taskboard_postgres_data`. A API cria e atualiza as tabelas automaticamente ao iniciar.

Para atualizar uma instalação existente:

```bash
git pull
docker compose up -d --build
```

### Publicação no Traefik existente

A publicação de `api.raccoonsoftwares.com` exige ações manuais na infraestrutura:

1. No DNS autoritativo de `raccoonsoftwares.com`, crie ou corrija somente o registro `A` `api` apontando para `187.127.61.49`. Não use protocolo ou porta no valor e não altere registros do domínio principal, email ou autenticação.
2. Confirme que TCP 80 e 443 estão acessíveis na Hostinger e no firewall do sistema. O Traefik usa 80 para o desafio HTTP do Let's Encrypt e 443 para o HTTPS.
3. Confirme que o Traefik em execução é o projeto existente, usa `network_mode: host`, tem o provider Docker e o resolver `letsencrypt`. Não implante um segundo Traefik e não crie a rede `traefik_public`.
4. Antes da atualização, confira os listeners e o conflito potencial do Nginx:

   ```bash
   docker ps --format 'table {{.Names}}\t{{.Ports}}'
   sudo ss -lntp | grep -E ':(80|443)\b'
   ```

5. Após a API estar em execução, descubra o IP privado real do container e teste `/health` na própria VPS. Não publique `8080` nem `5432` na internet.

O registro DNS, a autoridade dos nameservers, as portas abertas, o IP privado do container e o conflito efetivo entre Traefik e Nginx não podem ser confirmados a partir deste repositório.

Para rollback sem apagar volumes, salve o Compose antes da atualização e, se necessário, restaure essa cópia e recrie somente os serviços da aplicação:

```bash
# antes da atualização
cp docker-compose.yml /caminho/seguro/docker-compose.yml.anterior

# para reverter
cp /caminho/seguro/docker-compose.yml.anterior docker-compose.yml
docker compose config --quiet
docker compose up -d --build
```

Não execute `docker compose down -v`; o volume `taskboard_postgres_data` deve ser preservado.
